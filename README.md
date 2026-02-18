# VSCubing Desktop

An Electrobun desktop application for VSCubing with dual mode support - use the global online platform or practice offline with a local server.

## Features

- **Dual Mode**: Switch between Global (online) and Local (offline) modes
- **Global Mode**: Connect to vscubing.com with full contest and social features
- **Local Mode**: Practice offline with a local SQLite database
- **Persistent Sessions**: Login sessions persist between app restarts
- **Cross-Platform**: Available for macOS, Linux, and Windows

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) installed on your system

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/gemini-vscube.git
cd gemini-vscube

# Install dependencies
bun install

# Run in development mode
bun run start
```

## Usage

### Mode Selection

When you launch the app, you'll see a mode selector:

- **Global Mode**: Connects to https://vscubing.com - requires internet connection
- **Local Mode**: Starts a local server for offline practice

### Keyboard Shortcuts

- `Cmd/Ctrl + G` - Switch to Global mode
- `Cmd/Ctrl + L` - Switch to Local mode
- `Cmd/Ctrl + Shift + L` - Quick toggle between modes

### Local Mode

In Local mode, the app starts a Bun server on port 3000 with:
- SQLite database for storing solves
- Local user management
- Personal solve history and statistics
- Multiple discipline support (3x3, 2x2, 4x4, etc.)

## Development

### Project Structure

```
gemini-vscube/
├── src/
│   ├── bun/           # Main Electrobun process
│   ├── mainview/      # Mode selector UI
│   ├── local-server/  # Local Next.js-like server
│   │   ├── db/        # Database schema and connection
│   │   └── api/       # API routes
│   └── shared/        # Shared types
├── drizzle/           # Database migrations
└── .github/           # CI/CD workflows
```

### Scripts

- `bun run start` - Start development server
- `bun run build:dev` - Build for development
- `bun run build:release` - Build for production
- `bun run db:migrate` - Run database migrations
- `bun run db:studio` - Open Drizzle Studio

### Database

The local mode uses SQLite with Drizzle ORM. Database file is stored in:
- macOS: `~/Library/Application Support/VSCubing Desktop/data/local.db`
- Linux: `~/.config/VSCubing Desktop/data/local.db`
- Windows: `%APPDATA%/VSCubing Desktop/data/local.db`

## Building for Production

### Local Build

```bash
bun run build:release
```

### CI/CD

The project includes GitHub Actions workflows for automated builds on all platforms. Builds are triggered on:
- Push to `main` branch
- Tag push (creates releases)

## Architecture

### Dual Mode Design

1. **Global Mode**: Loads https://vscubing.com in a sandboxed webview with persistent cookies
2. **Local Mode**: Starts a Bun HTTP server that serves a local API and SPA

### Persistence

- Mode preference is stored in `settings.json`
- Login sessions use Electrobun's `partition: "persist:vscubing-session"`
- Local solves are stored in SQLite

## API Endpoints (Local Mode)

- `GET /health` - Health check
- `GET /api/disciplines` - List disciplines
- `POST /api/users` - Create/update user
- `GET /api/users/:id` - Get user
- `POST /api/solves` - Create solve
- `PATCH /api/solves/:id` - Update solve
- `POST /api/solves/list` - List solves
- `GET /api/stats/:userId/:disciplineSlug` - Get statistics
- `GET /api/settings/:userId` - Get user settings
- `POST /api/settings` - Update settings

## License

MIT License - see LICENSE file for details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgments

- Built with [Electrobun](https://electrobun.dev)
- Database powered by [Drizzle ORM](https://orm.drizzle.team)
- Original VSCubing platform at [vscubing.com](https://vscubing.com)
