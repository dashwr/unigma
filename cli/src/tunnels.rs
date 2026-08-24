/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

pub mod code_server;
pub mod paths;
pub mod protocol;
pub mod shutdown_signal;

pub mod agent_host;
pub mod agent_host_registry;
#[cfg(windows)]
mod agent_host_registry_acl_windows;
mod challenge;
mod control_server;
pub mod idle_timeout;
mod server_bridge;
mod server_multiplexer;
mod socket_signal;
pub mod user_data_path;

pub use control_server::{ready_active_agent_host, serve_stream, AuthRequired, ServeStreamParams,
	SharedActiveAgentHost};
