class GitHub {
  constructor(token) {
    this.token = token;
    this.base = 'https://api.github.com';
  }

  get headers() {
    const h = { 'Accept': 'application/vnd.github.v3+json' };
    if (this.token) h['Authorization'] = `token ${this.token}`;
    return h;
  }

  async listDir(path) {
    const { owner, repo, branch } = CONFIG;
    const res = await fetch(
      `${this.base}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
      { headers: this.headers }
    );
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  }

  async getFile(path) {
    const { owner, repo, branch } = CONFIG;
    const res = await fetch(
      `${this.base}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
      { headers: this.headers }
    );
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = await res.json();
    const content = fromBase64(data.content.replace(/[\n\r]/g, ''));
    return { content, sha: data.sha };
  }

  async putFile(path, content, message, sha) {
    const { owner, repo, branch } = CONFIG;
    const body = { message, content: toBase64(content), branch };
    if (sha) body.sha = sha;
    const res = await fetch(
      `${this.base}/repos/${owner}/${repo}/contents/${path}`,
      {
        method: 'PUT',
        headers: { ...this.headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  async deleteFile(path, message, sha) {
    const { owner, repo, branch } = CONFIG;
    const res = await fetch(
      `${this.base}/repos/${owner}/${repo}/contents/${path}`,
      {
        method: 'DELETE',
        headers: { ...this.headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sha, branch }),
      }
    );
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  }
}

function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach(b => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function fromBase64(str) {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
