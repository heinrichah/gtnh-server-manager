Set up a GTNH server
Note: you can also deploy the server inside a docker container. For a guide on doing that, see Server Setup (Container).

(Tip: when specifying files in linux you can autocomplete using the tab key).

For the next steps, when you see a command in this formatting, you should execute it by pasting it in your terminal. You can paste using the right mouse button.

Step 1. Update your server's packages to the newest versions.

apt update -y && apt upgrade -y

Step 2. Install java & unzip

apt install openjdk-21-jre-headless unzip -y

Step 3. Download the server zip from the downloads. You want the java 17-21 version. Right click -> copy URL to get the url to download.

wget [URL], e.g. (FOR VERSION 2.8.1), wget https://downloads.gtnewhorizons.com/ServerPacks/GT_New_Horizons_2.8.1_Server_Java_17-25.zip

Step 4. Unzip the server ZIP file into a folder called GTNH-Server. In this case (FOR VERSION 2.7.0),

unzip GT_New_Horizons_2.8.1_Server_Java_17-21.zip -d GTNH-Server

Step 5. Enter the server folder

cd GTNH-Server

Step 6. Edit the startserver-java9.sh file to use your server's capabilities. My server runs on 16GB, so I will set it to 12GB. the default is 6GB.

Step 6a. nano startserver-java9.sh

Step 6b. Go to like 7, where it says "java -Xms6G -Xmx6G ...", and change this to your desired amount, e.g. "java -Xms12G -Xmx12G ..."

Step 6c. Save using CTRL+O, press enter to confirm filename, and quit using CTRL+X

Step 6d. Make the startserver-java9.sh file runnable by using chmod +x startserver-java9.sh

Step 7. Accept the eula

echo "eula=true" > eula.txt

Configuring the mods
This will contain the most basic configuration options, but feel free to add or edit other mods.

Basic terminology:

ls will list all the files in your current directory.

cd [path] will change directory to a certain directory, so cd mods will bring you into the mods folder (if you're in the GTNH-Server folder).

cd .. will change directory to one above your current one, so if you're in mods, cd .. will bring you back to GTNH-Server.

nano [filename] will open a text editor for the file. To find something in a file, do CTRL+W, [string you want to find], enter. to save and quit, do CTRL+O, enter, CTRL+X

mv [file1] [file2] will move file1 to file2, so e.g. if you wanna move a mod that you accidentally downloaded into the main GTNH-Server folder, mv my-mod.jar mods/my-mod.jar would fix that

cp [file1] [file2] will copy file1 to file2.

Pollution
For turning off pollution, do nano config/GregTech/Pollution.cfg

Scroll down until it says "pollution {"

The line below that, edit B:"Activate Pollution"=true to B:"Activate Pollution"=false

Save and quit (CTRL+O, enter, CTRL+X)

Claiming, homes, etc.
For changing serverutilities settings like chunk claiming etc:

nano serverutilities/serverutilities.cfg

Under "commands {", change all the commands you want working from "false" to "true". if they are set to false, they won't work.

To enable backups, under "backups {" go to the line "B:enable_backups=false" and change it to "B:enable_backups=true". You can also change the amount, backups to keep, timer, etc.

To enable anything in regards to homes, chunk loading, chunk claiming, etc. go to "ranks {" and change "B:enabled=false" to "B:enabled=true".

To enable chunk claiming, go to "world {" and edit "B:chunk_claiming=false" and "B:chunk_loading=false" to "B:chunk_claiming=true" and "B:chunk_loading=true" respectively.

If you want anything like homes, chunk loading, chunk claiming to work, you must now edit nano serverutilities/server/ranks.txt

This guide reccomends adding "default_op_rank: true" to [player] and deleting [vip] and [admin] (and their lines below them). Then, change the remaining settings as wanted.



Running the server
If you run the server on the command line that you are in now, it will turn off when you disconnect. To make the server stay up even when you aren't SSH'd into it, we will create a virtual terminal that keeps running using screen.

To create a new screen / connect to it, do screen -R MC. Press enter. This will create a screen called MC.

In this new screen, you want to run your server. Do this by doing ./startserver-java9.sh. Wait AT THE VERY LEAST 5-10 minutes until the server has started.

Once the server has started, you can whitelist yourself (and your friends) by typing /whitelist add [username]

Then, you can connect to the server by connecting to the IP address in your GTNH client. This is the same IP address you used to SSH into. To detach from the screen, do "CTRL+A, d". To re-attach to the screen, do screen -r MC

To change anything about the config / settings / etc, make sure the server is off by attaching to the screen, typing /stop, and then when it's counting down from 12 to 1, CTRL+C before the countdown is over. Now you can make any edits, and then re-start the server by running ./serverstart-java9.sh again