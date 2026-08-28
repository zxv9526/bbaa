export async function onRequest(context) {
  return new Response(JSON.stringify({ message: "Hello from Cloudflare Functions!" }), {
    headers: {
      "content-type": "application/json;charset=UTF-8",
    },
  });
}
