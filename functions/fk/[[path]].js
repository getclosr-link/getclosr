// Same-origin path to the feedback gateway (FeedbackKit). The page loads the
// feedback widget only when someone clicks "Send feedback", and even then it
// talks to its own origin: no third-party host in the shipped HTML, and the
// gateway's address lives in the Pages environment variable FEEDBACKKIT_ORIGIN,
// not in this repo. Only the paths the widget uses are passed through.
const ALLOWED = /^(widget\.js|(urbanist|dm-sans)\.woff2|api\/(config|upload|feedback|events))$/;

export async function onRequest({ request, env, params }) {
  const origin = env.FEEDBACKKIT_ORIGIN;
  if (!origin) return new Response('feedback is not configured', { status: 503 });
  const path = Array.isArray(params.path) ? params.path.join('/') : (params.path || '');
  if (!ALLOWED.test(path)) return new Response('not found', { status: 404 });

  const target = new URL('/' + path + new URL(request.url).search, origin);
  const headers = new Headers(request.headers);
  headers.delete('cookie'); // nothing of this site travels on
  const hasBody = !['GET', 'HEAD'].includes(request.method);
  return fetch(target, { method: request.method, headers, body: hasBody ? request.body : undefined, redirect: 'manual' });
}
