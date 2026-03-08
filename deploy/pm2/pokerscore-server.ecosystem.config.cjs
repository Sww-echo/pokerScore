module.exports = {
  apps: [
    {
      name: "pokerscore-server",
      cwd: "/srv/pokerscore/current/server",
      script: "dist/main.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
    },
  ],
};
