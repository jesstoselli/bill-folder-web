const required = 'v24.15.0';

if (process.version !== required) {
  console.error(`BillFolder Web E2E requires Node ${required.slice(1)}; received ${process.version}.`);
  process.exit(1);
}
