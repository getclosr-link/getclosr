// Serves the static site from public/ and relays /fk/* to the feedback gateway
// (FeedbackKit). The page loads the feedback widget only when someone clicks
// "Send feedback", and even then it talks to its own origin: no third-party host
// in the shipped HTML, and the gateway's address lives in the Worker secret
// FEEDBACKKIT_ORIGIN, not in this repo. Only the paths the widget uses are passed
// through.
const ALLOWED = /^(widget\.js|(urbanist|dm-sans)\.woff2|api\/(config|upload|feedback|events))$/;

async function relayFeedback(request, env, path) {
  const origin = env.FEEDBACKKIT_ORIGIN;
  if (!origin) return new Response('feedback is not configured', { status: 503 });
  if (!ALLOWED.test(path)) return new Response('not found', { status: 404 });

  const target = new URL('/' + path + new URL(request.url).search, origin);
  const headers = new Headers(request.headers);
  headers.delete('cookie'); // nothing of this site travels on
  const hasBody = !['GET', 'HEAD'].includes(request.method);
  return fetch(target, { method: request.method, headers, body: hasBody ? request.body : undefined, redirect: 'manual' });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/fk/')) return relayFeedback(request, env, pathname.slice(4));
    return env.ASSETS.fetch(request);
  },
};
