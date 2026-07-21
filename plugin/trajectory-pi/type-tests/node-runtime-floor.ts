// @ts-expect-error Node 22 is supported, so Node 26-only APIs must stay outside the ambient type surface.
import { boundedChannel } from "node:diagnostics_channel";
