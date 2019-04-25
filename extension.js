const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Mainloop = imports.mainloop;

const LoginManager = imports.misc.loginManager;
const Main = imports.ui.main;
const StatusSystem = imports.ui.status.system;
const PopupMenu = imports.ui.popupMenu;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const ExtensionSystem = imports.ui.extensionSystem;
const ConfirmDialog = Me.imports.confirmDialog;
const Prefs = new Me.imports.prefs.Prefs();

const HIBERNATE_CHECK_TIMEOUT = 20000;

class Extension {
    _loginManagerCanHibernate(asyncCallback) {
        if (this._loginManager._proxy) {
            // systemd path
            this._loginManager._proxy.call("CanHibernate",
                null,
                Gio.DBusCallFlags.NONE,
                -1, null, function (proxy, asyncResult) {
                    let result, error;

                    try {
                        result = proxy.call_finish(asyncResult).deep_unpack();
                    } catch (e) {
                        error = e;
                    }

                    if (error)
                        asyncCallback(false);
                    else
                        asyncCallback(result[0] != 'no');
                });
        } else {
            Mainloop.idle_add(Lang.bind(this, function () {
                asyncCallback(false);
                return false;
            }));
        }
    }

    _loginManagerHibernate() {
        if (Prefs.getHibernateWorksCheckEnabled()) {
            this._hibernateStarted = new Date();
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, HIBERNATE_CHECK_TIMEOUT,
                Lang.bind(this, this._checkDidHibernate));
        }
        if (this._loginManager._proxy) {
            // systemd path
            this._loginManager._proxy.call("Hibernate",
                GLib.Variant.new('(b)', [true]),
                Gio.DBusCallFlags.NONE,
                -1, null, null);
        } else {
            // Can't do in ConsoleKit
            this._loginManager.emit('prepare-for-sleep', true);
            this._loginManager.emit('prepare-for-sleep', false);
        }
    }

    _loginManagerCanHybridSleep(asyncCallback) {
        if (this._loginManager._proxy) {
            // systemd path
            this._loginManager._proxy.call("CanHybridSleep",
                null,
                Gio.DBusCallFlags.NONE,
                -1, null, function (proxy, asyncResult) {
                    let result, error;

                    try {
                        result = proxy.call_finish(asyncResult).deep_unpack();
                    } catch (e) {
                        error = e;
                    }

                    if (error)
                        asyncCallback(false);
                    else
                        asyncCallback(result[0] != 'no');
                });
        } else {
            Mainloop.idle_add(Lang.bind(this, function () {
                asyncCallback(false);
                return false;
            }));
        }
    }

    _loginManagerHybridSleep() {
        if (this._loginManager._proxy) {
            // systemd path
            this._loginManager._proxy.call("HybridSleep",
                GLib.Variant.new('(b)', [true]),
                Gio.DBusCallFlags.NONE,
                -1, null, null);
        } else {
            // Can't do in ConsoleKit
            this._loginManager.emit('prepare-for-sleep', true);
            this._loginManager.emit('prepare-for-sleep', false);
        }
    }
    _updateHaveHibernate() {
        this._loginManagerCanHibernate(Lang.bind(this, function (result) {
            this._haveHibernate = result;
            this._updateHibernate();
        }));
    }

    _updateHibernate() {
        this._hibernateAction.visible = this._haveHibernate && !Main.sessionMode.isLocked;
    }

    _updateHaveHybridSleep() {
        this._loginManagerCanHybridSleep(Lang.bind(this, function (result) {
            this._haveHybridSleep = result;
            this._updateHybridSleep();
        }));
    }

    _updateHybridSleep() {
        this._hybridSleepAction.visible = this._haveHybridSleep && !Main.sessionMode.isLocked;
    }

    _onHibernateClicked() {
        this.systemMenu.menu.itemActivated();
        this._dialog = new ConfirmDialog.ConfirmDialog(ConfirmDialog.HibernateDialogContent);
        this._dialog.connect('ConfirmedHibernate', Lang.bind(this, this._loginManagerHibernate));
        this._dialog.open();
    }

    _onHybridSleepClicked() {
        this.systemMenu.menu.itemActivated();
        this._loginManagerHybridSleep();
    }

    _disableExtension() {
        let enabledExtensions = global.settings.get_strv(ExtensionSystem.ENABLED_EXTENSIONS_KEY);
        enabledExtensions.splice(enabledExtensions.indexOf(Me.uuid), 1);
        global.settings.set_strv(ExtensionSystem.ENABLED_EXTENSIONS_KEY, enabledExtensions);
    }

    _cancelDisableExtension(notAgain) {
        if (notAgain)
            Prefs.setHibernateWorksCheckEnabled(false);
    }

    _checkRequirements() {
        if (!LoginManager.haveSystemd()) {
            this._dialog = new ConfirmDialog.ConfirmDialog(ConfirmDialog.SystemdMissingDialogContent);
            this._dialog.connect('DisableExtension', this._disableExtension);
            this._dialog.open();
        }
    }

    _checkDidHibernate() {
        /* This function is called HIBERNATE_CHECK_TIMEOUT ms after
         * hibernate started. If it is successful, at that point the GS
         * process is already frozen; so when this function is actually
         * called, way more than HIBERNATE_CHECK_TIMEOUT ms are passed*/
        if (new Date() - this._hibernateStarted > HIBERNATE_CHECK_TIMEOUT + 5000) {
            // hibernate succeeded
            return;
        }
        // hibernate failed
        this._dialog = new ConfirmDialog.ConfirmDialog(ConfirmDialog.HibernateFailedDialogContent);
        this._dialog.connect('DisableExtension', this._disableExtension);
        this._dialog.connect('CancelHibernate', this._cancelDisableExtension);
        this._dialog.open();
    }

    enable() {
        this._checkRequirements();
        this._loginManager = LoginManager.getLoginManager();
        this.systemMenu = Main.panel.statusArea['aggregateMenu']._system;

        this._hibernateAction = this.systemMenu._createActionButton('document-save-symbolic', _("Hibernate"));
        this._hibernateActionId = this._hibernateAction.connect('clicked', Lang.bind(this, this._onHibernateClicked));

        this._hybridSleepAction = this.systemMenu._createActionButton('document-save-as-symbolic', _("HybridSleep"));
        this._hybridSleepActionId = this._hybridSleepAction.connect('clicked', Lang.bind(this, this._onHybridSleepClicked));

        this._altHibernateSwitcher = new StatusSystem.AltSwitcher(this._hibernateAction, this._hybridSleepAction);
        this.systemMenu._actionsItem.actor.insert_child_at_index(this._altHibernateSwitcher.actor, 4);

        this._menuOpenStateChangedId = this.systemMenu.menu.connect('open-state-changed', Lang.bind(this,
            function (menu, open) {
                if (!open)
                    return;
                this._hibernateAction.visible = true;
                this._updateHaveHibernate();
                this._updateHaveHybridSleep();
            }));
    }

    disable() {
        if (this._menuOpenStateChangedId) {
            this.systemMenu.menu.disconnect(this._menuOpenStateChangedId);
            this._menuOpenStateChangedId = 0;
        }

        if (this._hybridSleepActionId) {
            this._hybridSleepAction.disconnect(this._hybridSleepActionId);
            this._hybridSleepActionId = 0;
        }

        if (this._hibernateActionId) {
            this._hibernateAction.disconnect(this._hibernateActionId);
            this._hibernateActionId = 0;
        }

        this.systemMenu._actionsItem.actor.remove_child(this._altHibernateSwitcher.actor);

        if (this._altHibernateSwitcher) {
            this._altHibernateSwitcher.actor.destroy();
            this._altHibernateSwitcher = 0;
        }

        if (this._hybridSleepAction) {
            this._hybridSleepAction.destroy();
            this._hybridSleepAction = 0;
        }

        if (this._hibernateAction) {
            this._hibernateAction.destroy();
            this._hibernateAction = 0;
        }
    }
}

let extension;
function init() {
    extension = new Extension();
}

function enable() {
    extension.enable();
}

function disable() {
    extension.disable();
}
