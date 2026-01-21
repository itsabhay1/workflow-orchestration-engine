import { spawn } from 'child_process';

// Runs a Docker container for a workflow step
export function runContainer({ image, command, timeout }) {
  return new Promise((resolve, reject) => {
    const docker = spawn(
      'docker',
      ['run', '--rm', image, ...command],
      { stdio: 'inherit' }
    );

    const timer = setTimeout(() => {
      docker.kill('SIGKILL');
      reject(new Error('Execution timeout'));
    }, timeout * 1000);

    docker.on('exit', code => {
      clearTimeout(timer);

      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Container exited with code ${code}`));
      }
    });

    docker.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
