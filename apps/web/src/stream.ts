import { streamEventSchema, type StreamEvent } from '@kinetra/contracts';

export async function consumeStream(response: Response, onEvent: (event: StreamEvent) => void) {
  if (!response.ok || !response.body) throw new Error('Stream unavailable');
  if (!response.headers.get('content-type')?.includes('text/event-stream'))
    throw new Error('Invalid stream content type');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completed = false;
  try {
    while (!completed) {
      const { done, value } = await reader.read();
      if (done) throw new Error('Stream ended before completion');
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > 65536) throw new Error('Stream event too large');
      // Normalize CRLF only after an entire line is available, even across chunks.
      buffer = buffer.replaceAll('\r\n', '\n');
      let end = buffer.indexOf('\n\n');
      while (end !== -1) {
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const data = frame
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n');
        if (data) {
          const parsed: unknown = JSON.parse(data);
          const event = streamEventSchema.parse(parsed);
          onEvent(event);
          if (event.type === 'done') {
            completed = true;
            break;
          }
        }
        end = buffer.indexOf('\n\n');
      }
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}
