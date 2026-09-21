/**
 * @name QuickServerMute
 * @author ratu
 * @description EN : Adds a button on each server and folder in the left bar to mute/unmute with one click, with a clear visual indicator. FR : Ajoute un bouton sur chaque serveur et dossier de la barre de gauche pour les mute/démute en un clic, avec un indicateur visuel clair.
 * @version 1.1.0
 * @authorLink https://github.com/frarthur
 * @website https://noads.fr
 * @source https://github.com/frarthur/betterdiscord-quick-server-mute/
 */

module.exports = class QuickServerMute {
    constructor(meta) {
        this.meta = meta;
        this.styleId = "QuickServerMute-Styles";
        this.btnClass = "qsm-btn";
        this.itemClass = "qsm-item";
        this.mutedClass = "qsm-muted";
        this.partialClass = "qsm-partial";
        this.iconClass = "qsm-icon";
        this.observer = null;
        this.scanQueued = false;
        this.toggleFn = null;
        this.store = null;
        this.folderStore = null;
        this.flux = null;
        this.fluxSubscribed = false;
        this.warnedFolders = false;
        this.onFlux = () => this.queueScan();
    }

    start() {
        if (!BdApi?.Webpack || !BdApi?.DOM) {
            BdApi?.UI?.showToast("QuickServerMute : API BetterDiscord indisponible.", { type: "error" });
            return;
        }

        BdApi.DOM.addStyle(this.styleId, this.styles());

        this.observer = new MutationObserver(() => this.queueScan());
        this.observer.observe(document.body, { childList: true, subtree: true });

        this.subscribeFlux();
        this.queueScan();
    }

    stop() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        this.unsubscribeFlux();

        document.querySelectorAll(`.${this.btnClass}`).forEach(el => el.remove());
        document.querySelectorAll(`.${this.itemClass}`).forEach(el => el.classList.remove(this.itemClass, this.mutedClass, this.partialClass));
        document.querySelectorAll(`.${this.iconClass}`).forEach(el => el.classList.remove(this.iconClass));

        BdApi.DOM.removeStyle(this.styleId);
    }

    subscribeFlux() {
        const flux = this.getFlux();
        if (!flux) return;

        this.flux = flux;
        try {
            this.fluxEvents().forEach(ev => flux.subscribe(ev, this.onFlux));
            this.fluxSubscribed = true;
        }
        catch (err) {
            console.error("[QuickServerMute]", err);
        }
    }

    unsubscribeFlux() {
        if (!this.fluxSubscribed || !this.flux) return;

        this.fluxEvents().forEach(ev => {
            try { this.flux.unsubscribe(ev, this.onFlux); } catch (_) { /* ignore: handler may already be removed */ }
        });
        this.fluxSubscribed = false;
    }

    fluxEvents() {
        return [
            "USER_GUILD_SETTINGS_GUILD_UPDATE",
            "USER_GUILD_SETTINGS_GUILD_AND_CHANNELS_UPDATE",
            "USER_GUILD_SETTINGS_FULL_UPDATE"
        ];
    }

    getFlux() {
        const candidates = [
            BdApi.Webpack.getByKeys("subscribe", "unsubscribe", "dispatch"),
            BdApi.Webpack.getByKeys("actionLogger")
        ];

        return candidates.find(m => m
            && typeof m.subscribe === "function"
            && typeof m.unsubscribe === "function") || null;
    }

    getStore() {
        if (this.store) return this.store;
        this.store = BdApi.Webpack.getStore("UserGuildSettingsStore");
        return this.store;
    }

    getFolderStore() {
        if (this.folderStore) return this.folderStore;
        this.folderStore = BdApi.Webpack.getStore("SortedGuildStore");
        return this.folderStore;
    }

    isMuted(guildId) {
        try {
            return !!this.getStore()?.isMuted(guildId);
        }
        catch (_) {
            // Discord internals can throw while the store is still loading; treat as not muted.
            return false;
        }
    }

    getFolder(folderId) {
        const store = this.getFolderStore();
        if (!store) return null;

        try {
            let folder = store.getGuildFolderById?.(folderId);
            if (!folder) folder = store.getGuildFolderById?.(Number(folderId));

            if (!folder) {
                const list = store.getGuildFolders?.() || [];
                folder = list.find(f => String(f.folderId ?? f.id) === String(folderId));
            }

            if (!folder) return null;
            if (!this.folderGuildIds(folder).length) return null;
            return folder;
        }
        catch (_) {
            // Discord internals may return unexpected shapes; skip this folder instead of breaking the scan.
            return null;
        }
    }

    folderGuildIds(folder) {
        return folder.guildIds || folder.guild_ids || [];
    }

    folderName(folder) {
        return folder.folderName || folder.name || "Dossier";
    }

    getToggleFn() {
        if (this.toggleFn) return this.toggleFn;

        let mod = BdApi.Webpack.getByKeys("updateGuildNotificationSettings");
        let fn = typeof mod === "function" ? mod : mod?.updateGuildNotificationSettings;

        if (typeof fn !== "function") {
            mod = BdApi.Webpack.getModule(m => m && typeof m.updateGuildNotificationSettings === "function", { searchExports: true });
            fn = typeof mod === "function" ? mod : mod?.updateGuildNotificationSettings;
        }

        if (typeof fn === "function") this.toggleFn = fn;
        return this.toggleFn;
    }

    setMuted(guildId, muted) {
        const fn = this.getToggleFn();
        if (!fn) {
            BdApi.UI.showToast("QuickServerMute : API de mute Discord introuvable.", { type: "error" });
            return false;
        }

        const payload = muted
            ? { muted: true, mute_config: { selected_time_window: -1, end_time: null } }
            : { muted: false, mute_config: null };

        try {
            fn(guildId, payload);
            return true;
        }
        catch (err) {
            console.error("[QuickServerMute]", err);
            BdApi.UI.showToast("QuickServerMute : échec du changement de mute.", { type: "error" });
            return false;
        }
    }

    toggle(kind, id, item) {
        if (kind === "folder") return this.toggleFolder(id, item);

        const target = !this.isMuted(id);
        if (!this.setMuted(id, target)) return;

        this.applyVisual(item, id, target);
        BdApi.UI.showToast(`${this.getGuildName(id)} ${target ? "muté" : "démuté"}`, { type: target ? "info" : "success" });
        setTimeout(() => this.queueScan(), 400);
    }

    toggleFolder(folderId, item) {
        const folder = this.getFolder(folderId);
        if (!folder) return;

        const ids = this.folderGuildIds(folder);
        const target = !ids.every(id => this.isMuted(id));

        let changed = 0;
        for (const id of ids) {
            if (this.isMuted(id) === target) continue;
            if (this.setMuted(id, target)) changed++;
        }

        this.applyFolderVisual(item, folder, target);
        BdApi.UI.showToast(`${this.folderName(folder)} : ${changed} serveur(s) ${target ? "mutés" : "démutés"}`, { type: target ? "info" : "success" });
        setTimeout(() => this.queueScan(), 500);
    }

    getGuildName(guildId) {
        try {
            return BdApi.Webpack.getStore("GuildStore")?.getGuild(guildId)?.name || "Serveur";
        }
        catch (_) {
            // Guild store may be unavailable during startup; fall back to a generic label.
            return "Serveur";
        }
    }

    queueScan() {
        if (this.scanQueued) return;
        this.scanQueued = true;
        requestAnimationFrame(() => {
            this.scanQueued = false;
            this.scan();
        });
    }

    scan() {
        let folderItems = 0;
        document.querySelectorAll('[data-list-item-id^="guildsnav___"]').forEach(item => {
            const rawId = item.dataset.listItemId;
            if (!rawId) return;
            const id = rawId.replace("guildsnav___", "");

            if (/^\d{15,}$/.test(id)) {
                this.ensureButton(item, "guild", id);
                this.applyVisual(item, id);
                return;
            }

            if (/^\d+$/.test(id)) {
                const folder = this.getFolder(id);
                if (!folder) return;
                folderItems++;
                this.ensureButton(item, "folder", id);
                this.applyFolderVisual(item, folder);
            }
        });

        if (!folderItems && !this.warnedFolders && (this.getFolderStore()?.getGuildFolders?.() || []).some(f => f.folderId)) {
            this.warnedFolders = true;
            console.warn("[QuickServerMute] Des dossiers existent mais aucun bouton de dossier n'a été injecté. Signale-le avec ce message.");
        }
    }

    ensureButton(item, kind, id) {
        item.classList.add(this.itemClass);

        const existing = item.querySelector(`:scope > .${this.btnClass}`);
        if (existing) return existing;

        const btn = document.createElement("div");
        btn.className = this.btnClass;
        btn.dataset.qsmKind = kind;
        btn.setAttribute("role", "button");
        btn.tabIndex = 0;
        btn.innerHTML = this.bellIcon();

        const stop = e => { e.preventDefault(); e.stopPropagation(); };
        btn.addEventListener("mousedown", stop);
        btn.addEventListener("pointerdown", stop);
        btn.addEventListener("click", e => { stop(e); this.toggle(kind, id, item); });
        btn.addEventListener("keydown", e => {
            if (e.key === "Enter" || e.key === " ") { stop(e); this.toggle(kind, id, item); }
        });

        item.appendChild(btn);
        return btn;
    }

    tagIcon(item) {
        const icon = item.querySelector("img")
            || item.querySelector('[class*="acronym"]')
            || item.querySelector('[class*="childWrapper"]')
            || item.querySelector('[class*="folder"]');
        if (icon) icon.classList.add(this.iconClass);
    }

    applyVisual(item, guildId, forcedMuted) {
        const muted = typeof forcedMuted === "boolean" ? forcedMuted : this.isMuted(guildId);
        item.classList.toggle(this.mutedClass, muted);
        item.classList.remove(this.partialClass);

        const btn = item.querySelector(`:scope > .${this.btnClass}`);
        if (btn) {
            btn.classList.toggle(this.mutedClass, muted);
            btn.classList.remove(this.partialClass);
            const label = muted ? "Démuter le serveur" : "Muter le serveur";
            btn.title = label;
            btn.setAttribute("aria-label", label);
        }

        this.tagIcon(item);
    }

    applyFolderVisual(item, folder, forcedAllMuted) {
        const ids = this.folderGuildIds(folder);
        const mutedCount = ids.filter(id => this.isMuted(id)).length;
        const allMuted = typeof forcedAllMuted === "boolean" ? forcedAllMuted : (ids.length > 0 && mutedCount === ids.length);
        const partial = !allMuted && mutedCount > 0;

        item.classList.toggle(this.mutedClass, allMuted);
        item.classList.toggle(this.partialClass, partial);

        const btn = item.querySelector(`:scope > .${this.btnClass}`);
        if (btn) {
            btn.classList.toggle(this.mutedClass, allMuted);
            btn.classList.toggle(this.partialClass, partial);
            const label = allMuted ? "Démuter le dossier" : "Muter le dossier";
            btn.title = label;
            btn.setAttribute("aria-label", label);
        }

        this.tagIcon(item);
    }

    bellIcon() {
        return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
            + '<path d="M20 18.69L7.84 6.14 5.27 3.49 4 4.76l2.8 2.8v.01c-.52.99-.8 2.16-.8 3.42v5l-2 2v1h13.73l2 2L21 19.72l-1-1.03zM12 22c1.11 0 2-.89 2-2h-4c0 1.11.89 2 2 2zm6-7.32V11c0-3.08-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68c-.15.03-.29.08-.42.12-.1.03-.2.07-.3.11h-.01l-.02.01c-.23.09-.46.2-.68.31l-.01.01L18 14.68z"/>'
            + '</svg>';
    }

    styles() {
        return `
            [data-list-item-id^="guildsnav___"] { position: relative !important; }

            .${this.btnClass} {
                position: absolute;
                top: 1px;
                left: 1px;
                width: 18px;
                height: 18px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                background: var(--background-floating, #111214);
                box-shadow: 0 1px 4px rgba(0, 0, 0, .55);
                color: var(--interactive-normal, #b5bac1);
                cursor: pointer;
                z-index: 5;
                opacity: 0;
                transform: scale(.7);
                transition: opacity .12s ease, transform .12s ease, background-color .12s ease, color .12s ease;
            }
            .${this.btnClass} svg { width: 11px; height: 11px; display: block; pointer-events: none; }
            .${this.itemClass}:hover > .${this.btnClass},
            .${this.btnClass}:focus-visible { opacity: 1; transform: scale(1); }
            .${this.btnClass}:hover {
                background: var(--background-modifier-hover, #35373c);
                color: var(--interactive-hover, #dbdee1);
            }
            .${this.btnClass}.${this.mutedClass} {
                opacity: 1;
                transform: scale(1);
                color: #fff;
                background: #ed4245;
            }
            .${this.btnClass}.${this.mutedClass}:hover { background: #c93b3e; }
            .${this.btnClass}.${this.partialClass} {
                opacity: 1;
                transform: scale(1);
                color: #fff;
                background: #f0b232;
            }
            .${this.btnClass}.${this.partialClass}:hover { background: #d99f2b; }

            .${this.iconClass} { transition: filter .15s ease, opacity .15s ease; }
            .${this.mutedClass} .${this.iconClass} {
                filter: grayscale(1) brightness(.65);
                opacity: .55;
            }
            .${this.partialClass} .${this.iconClass} { opacity: .75; }
        `;
    }
};
