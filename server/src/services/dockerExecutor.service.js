import { spawn } from 'child_process';
import { exitCode } from 'process';

// Runs a Docker container for a workflow step
export function runContainer({ image, command, timeout }) {
  return new Promise((resolve, reject) => {
    const docker = spawn(
      'docker',
      ['run', '--rm', image, ...command]
    );

    let logs = '';

    // capture STDOUT
    docker.stdout.on('data', data => {
      logs += data.toString();
    });

    // capture STDERR
    docker.stderr.on('data', data => {
      logs += data.toString();
    });
    
    const timer = setTimeout(() => {
      docker.kill('SIGKILL');
      reject({
        message: 'Execution timeout',
        logs,
        exitCode: 124
      });
    }, timeout * 1000);

    docker.on('exit', code => {
      clearTimeout(timer);

      if (code === 0) {
        resolve({
          logs,
          exitCode: 0  // success
        });
      } else {
        reject({
          message: `Container exit with code ${code}`,
          logs,
          exitCode: code
        });
      }
    });

    docker.on('error', err => {
      clearTimeout(timer);
      reject({
        message: err.message,
        logs,
        exitCode: 1 
      });
    });
  });
}
