/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use futures::{stream::FuturesUnordered, StreamExt};
use std::{
	net::{IpAddr, Ipv4Addr, SocketAddr},
	str::FromStr,
};
use sysinfo::Pid;

use super::{args::CommandShellArgs, CommandContext};
use crate::{
	async_pipe::{get_socket_name, listen_socket_rw_stream, AsyncRWAccepter},
	log,
	tunnels::{serve_stream, shutdown_signal::ShutdownRequest, AuthRequired, ServeStreamParams},
	util::errors::{wrap, AnyError, CodeError},
	util::prereqs::PreReqChecker,
};

/// Runs the internal stdin/stdout control server without creating a public
/// Dev Tunnel.
pub async fn command_shell(ctx: CommandContext, args: CommandShellArgs) -> Result<i32, AnyError> {
	let platform = PreReqChecker::new().verify().await?;
	let mut shutdown_reqs = vec![ShutdownRequest::CtrlC];
	if let Some(p) = args.parent_process_id.and_then(|p| Pid::from_str(&p).ok()) {
		shutdown_reqs.push(ShutdownRequest::ParentProcessKilled(p));
	}

	let mut params = ServeStreamParams {
		log: ctx.log,
		launcher_paths: ctx.paths,
		platform,
		requires_auth: args
			.require_token
			.map(AuthRequired::VSDAWithToken)
			.unwrap_or(AuthRequired::VSDA),
		exit_barrier: ShutdownRequest::create_rx(shutdown_reqs),
		code_server_args: (&ctx.args).into(),
	};

	args.server_args.apply_to(&mut params.code_server_args);

	let mut listener: Box<dyn AsyncRWAccepter> =
		match (args.on_port.first(), &args.on_host, args.on_socket) {
			(_, _, true) => {
				let socket = get_socket_name();
				let listener = listen_socket_rw_stream(&socket)
					.await
					.map_err(|e| wrap(e, "error listening on socket"))?;

				params
					.log
					.result(format!("Listening on {}", socket.display()));
				Box::new(listener)
			}
			(Some(_), _, _) | (_, Some(_), _) => {
				let host = args
					.on_host
					.as_ref()
					.map(|h| h.parse().map_err(CodeError::InvalidHostAddress))
					.unwrap_or(Ok(IpAddr::V4(Ipv4Addr::LOCALHOST)))?;

				let lower_port = args.on_port.first().copied().unwrap_or_default();
				let port_no = if let Some(upper) = args.on_port.get(1) {
					find_unused_port(&host, lower_port, *upper)
						.await
						.unwrap_or_default()
				} else {
					lower_port
				};

				let addr = SocketAddr::new(host, port_no);
				let listener = tokio::net::TcpListener::bind(addr)
					.await
					.map_err(|e| wrap(e, "error listening on port"))?;

				params
					.log
					.result(format!("Listening on {}", listener.local_addr().unwrap()));
				Box::new(listener)
			}
			_ => {
				serve_stream(tokio::io::stdin(), tokio::io::stderr(), params).await;
				return Ok(0);
			}
		};

	let mut servers = FuturesUnordered::new();

	loop {
		tokio::select! {
			Some(_) = servers.next() => {},
			socket = listener.accept_rw() => {
				match socket {
					Ok((read, write)) => servers.push(serve_stream(read, write, params.clone())),
					Err(e) => {
						error!(params.log, &format!("Error accepting connection: {e}"));
						return Ok(1);
					}
				}
			},
			_ = params.exit_barrier.wait() => {
				while (servers.next().await).is_some() { }
				return Ok(0);
			}
		}
	}
}

async fn find_unused_port(host: &IpAddr, start_port: u16, end_port: u16) -> Option<u16> {
	for port in start_port..=end_port {
		if is_port_available(*host, port).await {
			return Some(port);
		}
	}
	None
}

async fn is_port_available(host: IpAddr, port: u16) -> bool {
	tokio::net::TcpListener::bind(SocketAddr::new(host, port))
		.await
		.is_ok()
}
