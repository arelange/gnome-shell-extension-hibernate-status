const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Mainloop = imports.mainloop;

const LoginManager = imports.misc.loginManager;
const Main = imports.ui.main;
const StatusSystem = imports.ui.status.system;
const PopupMenu = imports.ui.popupMenu;
const ModalDialog = imports.ui.modalDialog;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

const HibernateDialogContent = {
    subject: C_("title", "Hibernate"),
    description: "Do you really want to hibernate the system ?",
    confirmButtons: [{ signal: 'CancelHibernate',
                       label:  C_("button", "Cancel"),
                         key:    Clutter.Escape },
                     { signal: 'ConfirmedHibernate',
                       label:  C_("button", "Hibernate"),
                       default: true}],
    iconName: 'document-save-symbolic',
    iconStyleClass: 'end-session-dialog-shutdown-icon',
};

const SystemdMissingDialogContent = {
    subject: C_("title", "Hybernate button: Systemd Missing"),
    description: "Systemd seems to be missing and is required.",
    confirmButtons: [{ signal: 'CancelDisableExtension',
                       label:  C_("button", "Cancel"),
                         key:    Clutter.Escape },
                       { signal: 'DisableExtension',
                       label:  C_("button", "Disable Extension"),
                       default: true }],
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

const ConfirmDialog = new Lang.Class({
    Name: 'HibernateDialog',
    Extends: ModalDialog.ModalDialog,

    _init: function(dialog) {
        this.parent({ styleClass: 'end-session-dialog',
                      destroyOnClose: true });

        let mainContentLayout = new St.BoxLayout({ vertical: false });
        this.contentLayout.add(mainContentLayout,
                                      { x_fill: true,
                                        y_fill: false });

        this._iconBin = new St.Bin();
        mainContentLayout.add(this._iconBin,
                              { x_fill:  true,
                                y_fill:  false,
                                x_align: St.Align.END,
                                y_align: St.Align.START });

        let messageLayout = new St.BoxLayout({ vertical: true });
        mainContentLayout.add(messageLayout,
                              { y_align: St.Align.START });

        this._subjectLabel = new St.Label({ style_class: 'end-session-dialog-subject' });

        messageLayout.add(this._subjectLabel,
                          { y_fill:  false,
                            y_align: St.Align.START });

        this._descriptionLabel = new St.Label({ style_class: 'end-session-dialog-description' });

        messageLayout.add(this._descriptionLabel,
                          { y_fill:  true,
                            y_align: St.Align.START });

        // fill dialog

        _setLabelText(this._descriptionLabel, dialog.description);
        _setLabelText(this._subjectLabel, dialog.subject);

        if (dialog.iconName) {
            this._iconBin.child = new St.Icon({ icon_name: dialog.iconName,
                                                icon_size: _DIALOG_ICON_SIZE,
                                                style_class: dialog.iconStyleClass });
        }

        let buttons = [];
        for (let i = 0; i < dialog.confirmButtons.length; i++) {
            let signal = dialog.confirmButtons[i].signal;
            let label = dialog.confirmButtons[i].label;
            let keys = dialog.confirmButtons[i].key;
            buttons.push({ action: Lang.bind(this, function() {
                                       this.close();
                                       let signalId = this.connect('closed',
                                                                   Lang.bind(this, function() {
                                                                       this.disconnect(signalId);
                                                                       this._confirm(signal);
                                                                   }));
                                   }),
                           label: label,
                           key: keys });
        };

        this.setButtons(buttons);

    },

    _confirm: function(signal) {
        this.emit(signal);
    },

    cancel: function() {
        this.close();
    },

    Close: function(parameters, invocation) {
        this.close();
    }
});

