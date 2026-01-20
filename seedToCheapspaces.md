// TODO: Get VPS node support fully integrated, Os for the nodes

git clone this repo & branch
/** TODO: seed doesnt install `bun` yet..
- unzip is required to install bun `apt-get update && apt-get install -y unzip && curl -fsSL                     
   https://bun.sh/install | bash `
**/
cd seed && bash ./setup.sh

doppler login, copy code, direct user to link
git auth login, copy code, direct user to link
tailscale up 
gh auth login
/**
root@cheapspacesDEV:~# tailscale up                                             
                                                                                
To authenticate, visit:                                                         
                                                                                
        https://login.tailscale.com/a/16e8c8b9018160                            

Success.  

root@cheapspacesDEV:~# gh auth login
? Where do you use GitHub? GitHub.com
? What is your preferred protocol for Git operations on this host? HTTPS
? Authenticate Git with your GitHub credentials? Yes
? How would you like to authenticate GitHub CLI? Login with a web browser

! First copy your one-time code: CE34-876C
Press Enter to open https://github.com/login/device in your browser... 
**/

// TODO from seed /root allow running node-agent
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
