# JIRA Capacity Planner

A tool for importing CSV files from JIRA to visualize team capacity and workload distribution.

You can find the latest published version of the tool here: https://petenzl.github.io/jiradisco/

## Purpose

This project provides an interface for uploading and parsing JIRA CSV exports, then visualizing team capacity and workload to aid in sprint planning and resource allocation.

## Technologies

- [Next.js](https://nextjs.org) - React framework
- [React](https://reactjs.org) - UI library
- [TypeScript](https://www.typescriptlang.org) - Type safety
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [PapaParse](https://www.papaparse.com) - CSV parsing
- [Recharts](https://recharts.org) - Data visualization
- [React Dropzone](https://react-dropzone.js.org) - File uploads
- [date-fns](https://date-fns.org) - Date manipulation

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000/jiradisco/](http://localhost:3000/jiradisco/) with your browser to see the application.

Note that the `/jiradisco/` path is required otherwise you will get a 404.

## Available Commands

- `npm run dev` - Start the development server with Turbopack
- `npm run build` - Build the application for production
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint to check code quality
- `npm run test` - Run Jest tests
- `npm run test:watch` - Run Jest tests in watch mode
- `npm run typecheck` - Run TypeScript type checking

## Testing

This project uses [Jest](https://jestjs.org) for testing, with React Testing Library for component tests.

## Deployment

The application is published via GitHub Pages using Next.js static page outputs.
