# LSA Fee Management

Internal fee management application for Lords Skill Academy.

## Stack

- React and TypeScript
- Vite
- React Router
- Plain CSS
- GitHub Pages

## Local development

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm run build
npm run lint
```

## Deployment

The GitHub Actions workflow deploys the production `dist` directory to GitHub
Pages whenever the default branch is pushed. Enable **GitHub Actions** as the
Pages source in the repository settings before the first deployment.

Hash-based routing and Vite's relative asset base allow routes and assets to
work when the application is hosted under a repository subpath.
