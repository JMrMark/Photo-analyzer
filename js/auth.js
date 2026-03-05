// auth.js
// quota management and Google login

let userState = {
    isVIP: false
};

export const QUOTA_LIMIT = 10;
export const REFILL_INTERVAL = 3 * 60 * 1000;

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
    if (userState.isVIP) return true;
    const q = refillQuota();
    if (q.tokens >= count) {
        q.tokens -= count;
        saveQuota(q);
        return true;
    }
    return false;
}

export function updateQuotaDisplay(quotaElem) {
    if (userState.isVIP) {
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
            userState.isVIP = true;
            userInfoElem.textContent = '(VIP)';
            quotaElem.textContent = 'VIP: необмежено';
            console.log('User signed in as VIP');
        }
    }

    // Load Google script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
        console.log('Google Sign-In script loaded');
        if (window.google) {
            google.accounts.id.initialize({
                client_id: clientId,
                callback: handleGoogleResponse
            });
            google.accounts.id.renderButton(btnElement, { theme: 'outline', size: 'small' });
        }
    };
    document.head.appendChild(script);
}