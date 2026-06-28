module.exports = {
  apps: [
    {
      name: 'edu-tizimplus',
      script: 'src/local-server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 4020,
      },
    },
  ],
};
