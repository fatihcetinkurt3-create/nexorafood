(function () {
  const QUEUE_KEY = "nexoraFoodAiOfflineQueue.v1";

  function readQueue() {
    try {
      return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function writeQueue(queue) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(Array.isArray(queue) ? queue : []));
  }

  function enqueue(operation) {
    const queue = readQueue();
    const clientGeneratedId = operation.client_generated_id || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    if (queue.some((item) => item.client_generated_id === clientGeneratedId)) return clientGeneratedId;
    queue.push({
      ...operation,
      client_generated_id: clientGeneratedId,
      created_at: new Date().toISOString(),
      attempts: 0
    });
    writeQueue(queue);
    return clientGeneratedId;
  }

  async function flush(processor) {
    const queue = readQueue();
    if (!queue.length) return { ok: true, flushed: 0, failed: 0 };
    const remaining = [];
    let flushed = 0;
    for (const item of queue) {
      try {
        await processor(item);
        flushed += 1;
      } catch (error) {
        remaining.push({ ...item, attempts: Number(item.attempts || 0) + 1, last_error: error.message });
      }
    }
    writeQueue(remaining);
    return { ok: !remaining.length, flushed, failed: remaining.length };
  }

  function count() {
    return readQueue().length;
  }

  window.NexoraOfflineSync = {
    QUEUE_KEY,
    readQueue,
    writeQueue,
    enqueue,
    flush,
    count
  };
})();
