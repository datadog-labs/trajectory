# Trajectory MDM Setup Plugin

This plugin is for IT administrators who deploy Trajectory to developer
computers with an MDM product. Its `trajectory-mdm-setup` skill helps your
coding agent walk you through a deployment with the `trajectory-mdm` helper:

1. write the intent file,
2. check it,
3. prepare and verify the bundle,
4. place each file in your MDM and on your server.

The skill uses only `trajectory-mdm` commands. It never asks for an API key.
You enter each key only in your MDM.

`trajectory setup` does not install this plugin on developer computers.
Install it only in the coding agent that you use on your administrator
computer. You can also skip the plugin. Run
`trajectory-mdm agent-instructions --dir .` in your deployment folder, and
open your coding agent there. The helper writes instructions that the agent
reads on its own.

The helper's own guide is the reference for each step. Run
`trajectory-mdm user-guide` to read it. See also the
[Managed Endpoint Administrator Guide](../../docs/MANAGED-ENDPOINTS.md).
