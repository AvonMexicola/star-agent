/** Track owned clients before the first query, including clients still connecting. */
export function createPostgresPoolCloser(pool) {
  const disconnected = new Set();
  const connected = client => {
    const ended = new Promise(resolve => client.once('end', () => {
      disconnected.delete(ended);
      resolve();
    }));
    disconnected.add(ended);
  };
  pool.on('connect', connected);
  let closing;
  return () => closing ??= (async () => {
    try {
      // pg-pool removes clients before their socket end callbacks complete.
      // PostgreSQL must remain running until those clients actually disconnect.
      await pool.end();
      await Promise.all(disconnected);
    } finally {
      pool.off('connect', connected);
    }
  })();
}
