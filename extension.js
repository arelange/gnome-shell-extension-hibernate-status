const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Mainloop = imports.mainloop;

const LoginManager = imports.misc.loginManager;
const Main = imports.ui.main;
const StatusSystem = imports.ui.status.system;
const PopupMenu = imports.ui.popupMenu;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const ConfirmDialog = Me.imports.confirmDialog;
const ExtensionSystem = imports.ui.extensionSystem;

const Extension = new Lang.Class({
    Name: 'HibernateStatus.Extension',

    _init: function() {
    },

    _loginManagerCanHibernate: function (asyncCallback) {
        if (this._loginManager._proxy) {
            // systemd path
            this._loginManager._proxy.call("CanHibernate",
                null,
                Gio.DBusCallFlags.NONE,
                -1, null, function(proxy, asyncResult) {
                    let result, error;

                    try {
                        result = proxy.call_finish(asyncResult).deep_unpack();
                    } catch(e) {
                        error = e;
                    }

                    if (error)
                        asyncCallback(false);
                    else
                        asyncCallback(result[0] != 'no');
                });
        } else {
            Mainloop.idle_add(Lang.bind(this, function() {
                asyncCallback(false);
                return false;
            }));
        }
    },

    _loginManagerHibernate: function () {
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
    },

    _loginManagerCanHybridSleep: function (asyncCallback) {
        if (this._loginManager._proxy) {
            // systemd path
            this._loginManager._proxy.call("CanHybridSleep",
                             null,
                             Gio.DBusCallFlags.NONE,
                             -1, null, function(proxy, asyncResult) {
                                 let result, error;
    
                                 try {
                                     result = proxy.call_finish(asyncResult).deep_unpack();
                                 } catch(e) {
                                     error = e;
                                 }

                                 if (error)
                                     asyncCallback(false);
                                 else
                                     asyncCallback(result[0] != 'no');
                             });
        } else {
            Mainloop.idle_add(Lang.bind(this, function() {
                asyncCallback(false);
                return false;
            }));
        }
    },

    _loginManagerHybridSleep: function () {
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
    },
    _updateHaveHibernate: function() {
        this._loginManagerCanHibernate(Lang.bind(this, function(result) {
            this._haveHibernate = result;
            this._updateHibernate();
        }));
    },

    _updateHibernate: function() {
        this._hibernateAction.visible = this._haveHibernate && !Main.sessionMode.isLocked;
    },

    _updateHaveHybridSleep: function() {
        this._loginManagerCanHybridSleep(Lang.bind(this, function(result) {
            this._haveHybridSleep = result;
            this._updateHybridSleep();
        }));
    },

    _updateHybridSleep: function() {
        this._hybridSleepAction.visible = this._haveHybridSleep && !Main.sessionMode.isLocked;
    },

    _onHibernateClicked: function() {
        this.systemMenu.menu.itemActivated();
        this._dialog = new ConfirmDialog.ConfirmDialog(ConfirmDialog.HibernateDialogContent);
        this._dialog.connect('ConfirmedHibernate', Lang.bind(this, this._loginManagerHibernate));
        this._dialog.open();
    },

    _onHybridSleepClicked: function() {
        this.systemMenu.menu.itemActivated();
        this._loginManagerHybridSleep();
    },

    _checkRequirements: function() {
        if (!LoginManager.haveSystemd()) {
            this._dialog = new ConfirmDialog.ConfirmDialog(ConfirmDialog.SystemdMissingDialogContent);
            this._dialog.connect('DisableExtension', function() {
                let enabledExtensions = global.settings.get_strv(ExtensionSystem.ENABLED_EXTENSIONS_KEY);
                enabledExtensions.splice(enabledExtensions.indexOf(Me.uuid),1);
                global.settings.set_strv(ExtensionSystem.ENABLED_EXTENSIONS_KEY, enabledExtensions);
                });
            this._dialog.open();
	}
    },

    enable: function() {
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
            function(menu, open) {
                if (!open)
                    return;
                this._hibernateAction.visible = true;
                this._updateHaveHibernate();
                this._updateHaveHybridSleep();
            }));
    },

    disable: function() {
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
});

function init(metadata) {
    var extension = new Extension();
    return (extension);
}

