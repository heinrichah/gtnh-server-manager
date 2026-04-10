1. A web app that can be used to interact with a running gregtech - new horizons server (instructions for server in setup-instructions.md)
   - It should interact with the server by opening an ssh connection to some linux (ubuntu) host. 
   - The user should be able to configure multiple "servers". A specific ssh host would only contain a single gtnh instance.
2. It should be able to initially install the server, configure the server, using some UI options on the front end
   - When modifying settings, it needs to be able to take a bunch of setting updates, and once a "persist" button is clicked, it needs to stop the server, actually make the changes and start the server again
3. It should also be able to gracefully start and stop the server at will