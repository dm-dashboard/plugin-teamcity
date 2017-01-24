# dm-dashboard TeamCity plugin

This is a plugin for the [dm-dashboard](https://github.com/dm-dashboard/dashboard) that displays information from Jetbrains' popular [TeamCity](https://www.jetbrains.com/teamcity/) Build Server

## Features

1. Offline sync of build history for all projects on the server. The server side component consumes the TeamCity API regularly to get the most recent builds. These are stored locally in MongoDB. This allows for some data analysis and queries not possible via the API.
1. The following Widgets
  1. Build Status - Shows the most recent builds across all projects. Failed builds will always float to the top to stay visible.
  1. Build Health - 3 pie charts showing successful vs. failed builds over various timeframes
  1. Realtime Server Details - Shows the status of TeamCity's build queues, as well as currently running builds
1. Support for multiple servers
  
## Installation
 
1. Clone this repo
2. Copy the folder into [location of dashboard]/plugins/custom
3. Restart the server
4. Login as an admin user, you should now see a "TeamCity" item under the "Plugins" menu
5. Configure details for your TeamCity server(s)
6. Add the various widgets to your dashboard
