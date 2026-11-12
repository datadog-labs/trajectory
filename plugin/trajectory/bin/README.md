# Plugin binary directory

Claude Code adds this directory to `PATH` whenever it loads the Trajectory
plugin. Trajectory does not ship an executable inside the plugin. This file
keeps the directory present in source archives, local marketplaces, and
installed plugin caches. It does this without adding an unsupported launcher.
