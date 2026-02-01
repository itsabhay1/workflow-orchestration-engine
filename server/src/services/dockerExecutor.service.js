import { spawn } from 'child_process';
import { isShuttingDown } from '../utils/shutdown.utils.js';
import { exitCode } from 'process';

const runningContainers = new Map(); // stepRunId → child process

export function getRunningStepRunIds() {
  return Array.from(runningContainers.keys());
}

// Called during graceful shutdown
export async function stopAllContainers() {
  console.log('Stopping all running containers...');

  const stops = [];

  for (const [stepRunId, proc] of runningContainers.entries()) {
    console.log(`Sending SIGTERM to container for stepRun ${stepRunId}`);

    const p = new Promise(res => {
      proc.on('exit', () => {
        console.log(`Container for stepRun ${stepRunId} exited`);
        runningContainers.delete(stepRunId);
        res();
      });
    });

    proc.kill('SIGTERM');   // graceful stop

    // Force kill if still alive after 5s
    setTimeout(() => {
      if (!proc.killed) {
        console.log(`Force killing container for stepRun ${stepRunId}`);
        proc.kill('SIGKILL');
      }
    }, 5000);

    stops.push(p);
  }
  await Promise.all(stops);
  console.log('All containers stopped.');
}


// Runs a Docker container for a workflow step
export function runContainer({ stepRunId, image, command, timeout }) {
  return new Promise((resolve, reject) => {
    const docker = spawn(
      'docker',
      ['run', '--rm', image, ...command]
    );

    // register process
    runningContainers.set(stepRunId, docker);

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
      console.log(`Timeout for stepRun ${stepRunId}`);
      docker.kill('SIGKILL');
      runningContainers.delete(stepRunId);
      reject({
        message: 'Execution timeout',
        logs,
        exitCode: 124
      });
    }, (timeout+2) * 1000);    // grace window

    docker.on('exit',(code, signal) => {
      clearTimeout(timer);
      runningContainers.delete(stepRunId);

      if(isShuttingDown() && signal === 'SIGTERM'){               // shutdown case
        return reject({
          message: 'Execution interrupted due to engine shutdown',
          logs,
          exitCode: null,
          interrupted: true
        })
      }

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
      runningContainers.delete(stepRunId);
      reject({
        message: err.message,
        logs,
        exitCode: 1 
      });
    });
  });
}
