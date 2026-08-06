# GOAT Timer 🐐

**DISCLAIMER:** It's a work in progress still!!

A shared timer inspired by the original Cuckoo Timer, featuring link-based rooms and a cute pastel design.

## Features

- Shared rooms accessible through a unique URL
- Real-time timer synchronization
- Customizable work and break durations
- Pause, resume, and reset controls
- Manual switching between work and break modes
- Visual and audio notification when someone joins
- Notification and sound when the timer finishes
- Live participant list
- Responsive design for desktop and mobile devices
- No external server dependencies
- Built using Node.js

## Requirements

- Node.js 18 or later

## Running Locally

Clone or download the project, then open the project folder in a terminal.

Run:

```bash
npm start
```

Alternatively, you can start the server directly with:

```bash
node server.js
```

Then open the following address in your browser:

```text
http://localhost:3000
```

To test real-time synchronization, open the same room link in two different browser windows, private browser sessions, or devices.

## Sharing a Room

Each room has a unique link.

Copy the room link from the application and send it to another person. When the project is deployed online, they can open the link directly in their browser without installing anything.

A room link may look like this:

```text
https://your-domain.com/?room=ABCD12
```

## Deployment

The project can be deployed on any hosting platform that supports Node.js and persistent HTTP connections, including:

- Render
- Railway
- Fly.io
- A virtual private server

Use the following build command:

```text
npm install
```

Use the following start command:

```text
npm start
```

The server automatically uses the `PORT` environment variable provided by the hosting platform.

## Render Deployment

To deploy the project on Render:

1. Upload the project to a GitHub repository.
2. Log in to Render.
3. Create a new Web Service.
4. Connect your GitHub repository.
5. Select Node as the runtime.
6. Use `npm install` as the build command.
7. Use `npm start` as the start command.
8. Create the Web Service.

Once deployment is complete, Render will provide a public URL that you can share with other users.

## Notifications and Sounds

Browsers may block audio and notifications until the user interacts with the page.

To enable all features:

1. Open the room.
2. Click or tap anywhere on the page.
3. Allow browser notifications when requested.

The application can play sounds when:

- Someone joins the room
- The timer finishes
- A work or break session changes

## Current Limitations

Room and timer data are stored in the server memory.

This means active rooms may be reset when:

- The server restarts
- The project is redeployed
- A free hosting service suspends the server

For persistent rooms, the project can later be connected to Redis or another database.

## Project Structure

```text
pastel-goat-timer/
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── package.json
├── README.md
└── server.js
```

## License

This project is intended for personal, educational, and experimental use.
