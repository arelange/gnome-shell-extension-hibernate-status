const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Mainloop = imports.mainloop;

const LoginManager = imports.misc.loginManager;
const Main = imports.ui.main;
const StatusSystem = imports.ui.status.system;
const PopupMenu = imports.ui.popupMenu;
const ModalDialog = imports.ui.modalDialog;
const CheckBox = imports.ui.checkBox.CheckBox;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const ExtensionUtils = imports.misc.extensionUtils;

// Use __ () and N__() for the extension gettext domain, and reuse
// the shell domain with the default _() and N_()
const Gettext = imports.gettext.domain('hibernate-status-button');
const __ = Gettext.gettext;
const N__ = function(e) { return e };

ExtensionUtils.initTranslations('hibernate-status-button');

var HibernateDialogContent = {
    subject: C_("title", __("Hibernate")),
    description: __("Do you really want to hibernate the system?"),
    confirmButtons: [{
        signal: 'Cancel',
        label: C_("button", __("Cancel")),
        key: Clutter.Escape
    },
    {
        signal: 'ConfirmedHibernate',
        label: C_("button", __("Hibernate")),
        default: true
    }],
    iconName: 'document-save-symbolic',
    iconStyleClass: 'end-session-dialog-shutdown-icon',
};

var SystemdMissingDialogContent = {
    subject: C_("title", __("Hibernate button: Systemd Missing")),
    description: __("Systemd seems to be missing and is required."),
    confirmButtons: [{
        signal: 'Cancel',
        label: C_("button", __("Cancel")),
        key: Clutter.Escape
    },
    {
        signal: 'DisableExtension',
        label: C_("button", __("Disable Extension")),
        default: true
    }],
    iconName: 'document-save-symbolic',
    iconStyleClass: 'end-session-dialog-shutdown-icon',
};


var HibernateFailedDialogContent = {
    subject: C_("title", __("Hibernate button: Hibernate failed")),
    description: __("Looks like hibernation failed.\n" +
        "On some linux distributions hibernation is disabled\n" +
        "because not all hardware supports it well;\n" +
        "please check your distribution documentation\n" +
        "on how to enable it."),
    checkBox: __("You are wrong, don't check this anymore!"),
    confirmButtons: [{
        signal: 'Cancel',
        label: C_("button", __("Cancel")),
        key: Clutter.Escape
    },
    {
        signal: 'DisableExtension',
        label: C_("button", __("Disable Extension")),
        default: true
    }],
    iconName: 'document-save-symbolic',
    iconStyleClass: 'end-session-dialog-shutdown-icon',
};

const _DIALOG_ICON_SIZE = 32;

function _setLabelText(label, text) {
    if (text) {
        label.set_text(text);
        label.show();
    } else {
        label.set_text('');
        label.hide();
    }
}

var ConfirmDialog = GObject.registerClass({
    Signals: { 'ConfirmedHibernate': { param_types: [ GObject.TYPE_BOOLEAN ] },
               'DisableExtension': { param_types: [ GObject.TYPE_BOOLEAN ] },
               'Cancel': { param_types: [ GObject.TYPE_BOOLEAN ] } }
},
class ConfirmDialog extends ModalDialog.ModalDialog {
    _init(dialog) {
        super._init({
            styleClass: 'end-session-dialog',
            destroyOnClose: true
        });

        let mainContentLayout = new St.BoxLayout({
            vertical: false,
            x_expand: true ,
            y_expand: false
        });
        this.contentLayout.add(mainContentLayout);

        this._iconBin = new St.Bin({
            x_expand: true,
            y_expand: false,
            x_align: St.Align.END,
            y_align: St.Align.START
        });
        mainContentLayout.add(this._iconBin);

        let messageLayout = new St.BoxLayout({
            vertical: true,
            y_align: St.Align.START
        });
        mainContentLayout.add(messageLayout);

        this._subjectLabel = new St.Label({
            style_class: 'end-session-dialog-subject',
            y_expand: false,
            y_align: St.Align.START
        });

        messageLayout.add(this._subjectLabel);

        this._descriptionLabel = new St.Label({
            style_class: 'end-session-dialog-description',
            y_expand: true,
            y_align: St.Align.START
        });

        messageLayout.add(this._descriptionLabel);

        // fill dialog

        _setLabelText(this._descriptionLabel, dialog.description);
        _setLabelText(this._subjectLabel, dialog.subject);

        if (dialog.iconName) {
            this._iconBin.child = new St.Icon({
                icon_name: dialog.iconName,
                icon_size: _DIALOG_ICON_SIZE,
                style_class: dialog.iconStyleClass
            });
        }

        if (dialog.checkBox) {
            this._checkBox = new CheckBox(dialog.checkBox);
            mainContentLayout.add(this._checkBox.actor);
        }

        let buttons = [];
        for (let i = 0; i < dialog.confirmButtons.length; i++) {
            let signal = dialog.confirmButtons[i].signal;
            let label = dialog.confirmButtons[i].label;
            let keys = dialog.confirmButtons[i].key;
            buttons.push({
                action: () => {
                    let signalId = this.connect('closed',
                        () => {
                            this.disconnect(signalId);
                            this._confirm(signal);
                        });
                    this.close();
                },
                label: label,
                key: keys
            });
        };

        this.setButtons(buttons);

    }

    _confirm(signal) {
        var checked;
        if (this._checkBox)
            checked = this._checkBox.actor.get_checked()
        this.emit(signal, checked);
    }

    cancel() {
        this.close();
    }
});
