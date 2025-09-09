export function sanitizeHtmlBasic(html: string): string {
  if (!html) return '';
  let out = html.replace(/<\/(?:script|style)>/gi, '').replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
  out = out.replace(/ on[a-z]+=(\"[^\"]*\"|'[^']*')/gi, '').replace(/javascript:/gi, '');
  const allowed = /^(a|b|strong|i|em|u|p|br|ul|ol|li|h1|h2|h3|table|thead|tbody|tr|th|td|img|hr|div)$/i;
  out = out.replace(/<\/?([a-z0-9-]+)(\s+[^>]*?)?>/gi, (m, tag) => allowed.test(tag) ? m : '');
  return out;
}