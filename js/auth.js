// auth.js
// quota management and Google login stub

export let isVIP = false;
export const QUOTA_LIMIT = 5;
export const REFILL_INTERVAL = 5 * 60 * 1000;

function loadQuota() {
    const data = JSON.parse(localStorage.getItem('quota') || '{}');
    return {
        tokens: data.tokens != null ? data.tokens : QUOTA_LIMIT,
        lastRefill: data.lastRefill || Date.now()
    };
}

function saveQuota(q) {
    localStorage.setItem('quota', JSON.stringify(q));
}

export function refillQuota() {
    const q = loadQuota();
    const now = Date.now();
    const elapsed = now - q.lastRefill;
    const intervals = Math.floor(elapsed / REFILL_INTERVAL);
    if (intervals > 0) {
        q.tokens = Math.min(QUOTA_LIMIT, q.tokens + intervals);
        q.lastRefill += intervals * REFILL_INTERVAL;
        saveQuota(q);
    }
    return q;
}

export function canUpload(count = 1) {
    if (isVIP) return true;
    const q = refillQuota();
    if (q.tokens >= count) {
        q.tokens -= count;
        saveQuota(q);
        return true;
    }
    return false;
}

export function updateQuotaDisplay(quotaElem) {
    if (isVIP) {
        quotaElem.textContent = 'VIP: необмежено';
    } else {
        const q = refillQuota();
        let msg = `Доступні спроби: ${q.tokens}`;
        if (q.tokens < QUOTA_LIMIT) {
            const nextIn = REFILL_INTERVAL - (Date.now() - q.lastRefill);
            const mins = Math.ceil(nextIn / 60000);
            msg += `. Наступна за ${mins} хв.`;
        }
        quotaElem.textContent = msg;
    }
}

export function initGoogleLogin(clientId, btnElement, userInfoElem, quotaElem) {
    function handleGoogleResponse(response) {
        if (response.credential) {
            isVIP = true;
            userInfoElem.textContent = '(VIP)';
            quotaElem.textContent = 'VIP: необмежено';
        }
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => {
        google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleResponse
        });
        google.accounts.id.renderButton(btnElement, { theme: 'outline', size: 'small' });
    };
    document.head.appendChild(script);
}