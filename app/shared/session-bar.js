// Small "who am I" pill shown on every page: current user, roles, switch user, sign out
(function () {
    'use strict';
    if (window.__retSessionBar) { return; }
    window.__retSessionBar = true;

    var LABEL = { YardWorker: 'Yard Worker', BillingClerk: 'Billing Clerk' };

    var style = document.createElement('style');
    style.textContent =
        '#ret-bar{position:fixed;top:6px;left:50%;transform:translateX(-50%);z-index:100000;font-family:"Segoe UI",system-ui,sans-serif;font-size:13px}' +
        '#ret-bar .pill{display:flex;align-items:center;gap:8px;background:#1F2A37;color:#fff;border:1px solid #F2A900;border-radius:99px;padding:5px 14px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.25);font:inherit}' +
        '#ret-bar .pill:hover{background:#2E3B4E}' +
        '#ret-menu{display:none;position:absolute;top:38px;left:50%;transform:translateX(-50%);min-width:260px;background:#fff;color:#1B2433;border-radius:12px;border-top:4px solid #F2A900;box-shadow:0 8px 24px rgba(31,42,55,.25);padding:10px 0;overflow:hidden}' +
        '#ret-menu.open{display:block}' +
        '#ret-menu .who{padding:6px 16px 10px;border-bottom:1px solid #EEF1F6;word-break:break-all}' +
        '#ret-menu .who small{display:block;color:#5F6B7A}' +
        '#ret-menu .role{display:inline-block;background:#FCEBB6;color:#6B4D00;border-radius:99px;padding:2px 9px;font-size:12px;font-weight:600;margin:6px 6px 0 0}' +
        '#ret-menu a{display:block;padding:9px 16px;color:#1F2A37;text-decoration:none;cursor:pointer}' +
        '#ret-menu a:hover{background:#F4F5F7}' +
        '#ret-menu hr{border:0;border-top:1px solid #EEF1F6;margin:6px 0}';
    document.head.appendChild(style);

    var bar = document.createElement('div'); bar.id = 'ret-bar';
    var pill = document.createElement('button'); pill.type = 'button'; pill.className = 'pill'; pill.textContent = 'Checking sign-in…';
    var menu = document.createElement('div'); menu.id = 'ret-menu';
    bar.appendChild(pill); bar.appendChild(menu);

    function link(text, href) {
        var a = document.createElement('a'); a.textContent = text; a.href = href || '#';
        return a;
    }

    function render(me, dev) {
        var roles = (me.roles || []).map(function (r) { return LABEL[r] || r; });
        pill.textContent = '👤 ' + String(me.id).split('@')[0] + ' · ' + (roles.join(' / ') || 'no role') + ' ▾';
        pill.onclick = function (e) { e.stopPropagation(); menu.classList.toggle('open'); };
        menu.textContent = '';
        var who = document.createElement('div'); who.className = 'who';
        var s = document.createElement('small'); s.textContent = 'Signed in as'; who.appendChild(s);
        who.appendChild(document.createTextNode(me.id)); who.appendChild(document.createElement('br'));
        roles.forEach(function (r) { var b = document.createElement('span'); b.className = 'role'; b.textContent = r; who.appendChild(b); });
        menu.appendChild(who);
        menu.appendChild(link('🏠 Home', '/landing/index.html'));
        if (me.isManager || me.isAdmin || me.isAuditor || me.isBillingClerk || me.isDispatcher) { menu.appendChild(link('📊 Dashboard', '/dashboard/index.html')); }
        if (me.isYardWorker || me.isDispatcher || me.isTechnician || me.isManager || me.isAdmin) { menu.appendChild(link('📱 Yard app', '/yard/index.html')); }
        menu.appendChild(document.createElement('hr'));
        menu.appendChild(link('🔁 Switch user / role', dev ? '/switch/index.html' : '/logout'));
        menu.appendChild(link('🚪 Sign out', '/logout'));
    }

    function renderSignedOut(dev) {
        pill.textContent = '🔑 Sign in';
        pill.onclick = function () { location.href = dev ? '/switch/index.html' : '/landing/index.html'; };
    }

    function load() {
        fetch('/dev/users', { credentials: 'same-origin' }).then(function (r) { return r.ok; }, function () { return false; })
            .then(function (dev) {
                fetch('/odata/v4/session/me()', { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
                    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
                    .then(function (me) { render(me, dev); })
                    .catch(function () { renderSignedOut(dev); });
            });
    }

    document.addEventListener('click', function () { menu.classList.remove('open'); });
    function mount() { document.body.appendChild(bar); load(); }
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', mount); } else { mount(); }
})();
