/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { AgentSessionsService, IAgentSessionsService } from './agentSessionsService.js';

// The Agents Window UI (viewer, sidebar and its actions) is not part of this
// product. The session model behind it is still a dependency of the shared chat
// stack — the chat widget, the chat view pane, the terminal tools and the
// `MainThreadChatSessions` extension host customer all resolve it. Registering
// only the service keeps those consumers working without contributing any of
// the removed surfaces.
registerSingleton(IAgentSessionsService, AgentSessionsService, InstantiationType.Delayed);
