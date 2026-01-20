// TODO: Get VPS node support fully integrated, Os for the nodes

git clone this repo & branch
/** TODO: seed doesnt install `bun` yet..
- unzip is required to install bun `apt-get update && apt-get install -y unzip && curl -fsSL                     
   https://bun.sh/install | bash `
**/
cd seed && bash ./setup.sh

doppler login, copy code, direct user to link
git auth login, copy code, direct user to link
// TODO from seed root allow running node-agent
/** TODO config machines 
~/.tmux.conf:                                                          
  # Change prefix to Ctrl+a (easier)                                            
  set -g prefix C-a                                                             
  unbind C-b                                                                    
  bind C-a send-prefix                                                          
                                                                                
  # Enable mouse                                                                
  set -g mouse on                                                               
                                                                                
  # Number windows/panes from 1                                                 
  set -g base-index 1                                                           
  setw -g pane-base-index 1       
**/

bun run dev
