// Signed-in users' groups and bill history live on the server (backend routes/userData.js);
// guests keep them in localStorage. The session cookie identifies the user.

async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${method} ${url} failed: ${res.status}`)
  return res.json()
}

// → { crews, bills }
export function loadUserData() {
  return request('GET', '/api/me/data')
}

// Hands the guest's local groups/history to the account; resolves with the merged data.
export function importGuestData(crews, bills) {
  return request('POST', '/api/me/import', { crews, bills })
}

// Fire-and-forget writes: the screen already shows the change; a failed save only means
// it won't be there on the next device or reload.
function logSyncError(err) {
  console.error('Sync failed:', err.message)
}

export function saveCrew(crew) {
  request('PUT', `/api/me/crews/${encodeURIComponent(crew.id)}`, { data: crew }).catch(logSyncError)
}

export function deleteCrew(id) {
  request('DELETE', `/api/me/crews/${encodeURIComponent(id)}`).catch(logSyncError)
}

export function saveBill(bill) {
  request('PUT', `/api/me/bills/${encodeURIComponent(bill.id)}`, { data: bill }).catch(logSyncError)
}
