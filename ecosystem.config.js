module.exports = {
  apps: [
    {
      name: "fcm-api-server",
      script: "src/server.js",
      instances: 1,
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      log_file: "./logs/pm2-combined.log",
      time: true,
      max_memory_restart: "500M",
      node_args: "--max-old-space-size=512",
    },
    {
      name: "fcm-notification-worker",
      script: "src/workers/notificationWorker.js",
      instances: 2,
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
      },
      error_file: "./logs/worker-error.log",
      out_file: "./logs/worker-out.log",
      log_file: "./logs/worker-combined.log",
      time: true,
      max_memory_restart: "300M",
    },
    {
      name: "fcm-scheduled-worker",
      script: "src/workers/scheduledWorker.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
      error_file: "./logs/scheduled-error.log",
      out_file: "./logs/scheduled-out.log",
      log_file: "./logs/scheduled-combined.log",
      time: true,
      max_memory_restart: "200M",
    },
  ],
}
