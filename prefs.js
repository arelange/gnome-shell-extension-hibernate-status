import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
// Use __() and N__() for the extension gettext domain, and reuse
// the shell domain with the default _() and N_()
import { EFIBootManager } from './customreboot/efibootmgr.js';
import { Grub } from './customreboot/grub.js';
import { SystemdBoot } from './customreboot/systemdBoot.js';
import {
    ExtensionPreferences,
    gettext as __,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
const N__ = function (e) {
    return e;
};

export default class Prefs extends ExtensionPreferences {
    /**
     * Creates a new Settings-object to access the settings of this extension.
     * @private
     */
    constructor(metadata) {
        super(metadata);
        this.KEY_HIBERNATE_WORKS_CHECK = 'hibernate-works-check';
        this._schemaName = 'org.gnome.shell.extensions.hibernate-status-button';
        this._setting = this.getSettings()
    }
    /**
     * <p>Binds the given 'callback'-function to the "changed"-signal on the given
     *  key.</p>
     * <p>The 'callback'-function is passed an argument which holds the new
     *  value of 'key'. The argument is of type "GLib.Variant". Given that the
     *  receiver knows the internal type, use one of the get_XX()-methods to get
     *  it's actual value.</p>
     * @see http://www.roojs.com/seed/gir-1.2-gtk-3.0/gjs/GLib.Variant.html
     * @param key the key to watch for changes.
     * @param callback the callback-function to call.
     */
    bindKey(key, callback) {
        // Validate:
        if (key === undefined || key === null || typeof key !== 'string') {
            throw TypeError("The 'key' should be a string. Got: '" + key + "'");
        }
        if (
            callback === undefined ||
            callback === null ||
            typeof callback !== 'function'
        ) {
            throw TypeError(
                "'callback' needs to be a function. Got: " + callback
            );
        }
        // Bind:
        this._setting.connect('changed::' + key, function (source, key) {
            callback(source.get_value(key));
        });
    }
    /**
     * Get if check for working hibernation is enabled. The user might
     * choose to disable it if we happen to be wrong.
     *
     * @returns bool true if we need to check if hibernation works.
     */
    getHibernateWorksCheckEnabled() {
        return this._setting.get_boolean(this.KEY_HIBERNATE_WORKS_CHECK);
    }
    /**
     * Set if check for working hibernation is enabled. The user might
     * choose to disable it if we happen to be wrong.
     *
     * @returns bool true if we need to check if hibernation works.
     */
    setHibernateWorksCheckEnabled(enabled) {
        let key = this.KEY_HIBERNATE_WORKS_CHECK;
        if (this._setting.is_writable(key)) {
            if (this._setting.set_boolean(key, enabled)) {
                Gio.Settings.sync();
            } else {
                throw this._errorSet(key);
            }
        } else {
            throw this._errorWritable(key);
        }
    }
    _errorWritable(key) {
        return "The key '" + key + "' is not writable.";
    }
    _errorSet(key) {
        return "Couldn't set the key '" + key + "'";
    }
    fillPreferencesWindow(window) {
        const page = new Adw.PreferencesPage({
            title: __('General'),
            icon_name: 'dialog-information-symbolic',
        });
        window.add(page);

        const modes_group = new Adw.PreferencesGroup({
            title: __('Modes'),
            description: __('Which buttons should be enabled'),
        });
        page.add(modes_group);

        const suspend_row = new Adw.SwitchRow({
            title: __('Suspend'),
        });
        modes_group.add(suspend_row);
        const hibernate_row = new Adw.SwitchRow({
            title: __('Hibernate'),
        });
        modes_group.add(hibernate_row);
        const hybrid_row = new Adw.SwitchRow({
            title: __('Hybrid sleep'),
        });
        modes_group.add(hybrid_row);
        const suspend_then_hibernate_row = new Adw.SwitchRow({
            title: __('Suspend then hibernate'),
        });
        modes_group.add(suspend_then_hibernate_row);
        const restart_row = new Adw.SwitchRow({
            title: __('Restart...'),
        });
        modes_group.add(restart_row);
        const shutdown_row = new Adw.SwitchRow({
            title: __('Shutdown...'),
        });
        modes_group.add(shutdown_row);

        const dialog_group = new Adw.PreferencesGroup({
            title: __('Dialogs'),
            description: __('Which dialogs should be enabled'),
        });
        page.add(dialog_group);

        const hibernate_dialog_row = new Adw.SwitchRow({
            title: __('Hibernate'),
        });
        dialog_group.add(hibernate_dialog_row);
        const hybrid_dialog_row = new Adw.SwitchRow({
            title: __('Hybrid sleep'),
            subtitle: __('Not implemented yet'),
        });
        dialog_group.add(hybrid_dialog_row);
        const suspend_then_hibernate_dialog_row = new Adw.SwitchRow({
            title: __('Suspend then hibernate'),
            subtitle: __('Not implemented yet'),
        });
        dialog_group.add(suspend_then_hibernate_dialog_row);

        window._settings = this.getSettings();
        window._settings.bind('show-suspend', suspend_row, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        window._settings.bind('show-hibernate', hibernate_row, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        window._settings.bind('show-hybrid-sleep', hybrid_row, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        window._settings.bind('show-suspend-then-hibernate', suspend_then_hibernate_row, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        window._settings.bind('show-restart', restart_row, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        window._settings.bind('show-shutdown', shutdown_row, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        window._settings.bind('show-hibernate-dialog', hibernate_dialog_row, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        window._settings.bind('show-hybrid-sleep-dialog', hybrid_dialog_row, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        window._settings.bind('show-suspend-then-hibernate-dialog', suspend_then_hibernate_dialog_row, 'active',
            Gio.SettingsBindFlags.DEFAULT);
            
        const reboot_page = new Adw.PreferencesPage({
            title: __('Custom Reboot'),
            icon_name: 'system-reboot-symbolic',
        });
        const reboot_group = new Adw.PreferencesGroup();
        reboot_page.add(reboot_group);
    
        // Create row for efibootmgr
        const efi = new Adw.ActionRow({ title: 'Use EFI Boot Manager (efibootmgr)' });
    
        // Create row for grub
        const grub = new Adw.ActionRow({ title: 'Use Grub'});
    
        // Create row for systemd-boot
        const sysd = new Adw.ActionRow({ title: 'Use Systemd Boot'});
    
        // Add rows
        reboot_group.add(efi);
        reboot_group.add(grub);
        reboot_group.add(sysd);
        
        let settings = window._settings
    
        // Create switch for efibootmgr
        const efi_switch = new Gtk.Switch({
            active: settings.get_boolean('use-efibootmgr'),
            valign: Gtk.Align.CENTER,
        });
    
        // Create switch for grub
        const grub_switch = new Gtk.Switch({
            active: settings.get_boolean('use-grub'),
            valign: Gtk.Align.CENTER,
        });
    
        // Create switch for systemd-boot
        const sysd_switch = new Gtk.Switch({
            active: settings.get_boolean('use-systemd-boot'),
            valign: Gtk.Align.CENTER,
        });
    
        // Bind settings for efibootmgr
        settings.bind(
            'use-efibootmgr',
            efi_switch,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
    
        // Bind settings for grub
        settings.bind(
            'use-grub',
            grub_switch,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
    
        // Bind settings for systemd-boot
        settings.bind(
            'use-systemd-boot',
            sysd_switch,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
    
        // Add the switch for efibootmgr
        efi.add_suffix(efi_switch);
        efi.activatable_widget = efi_switch;
    
        // Add the switch for grub
        grub.add_suffix(grub_switch);
        grub.activatable_widget = grub_switch;
    
        // Add the switch for systemd-boot
        sysd.add_suffix(sysd_switch);
        sysd.activatable_widget = sysd_switch;
    
        // Add our page to the window
        window.add(reboot_page);
    
        (async () => {
            // Disable/enable switches in accordance to them being usable
    
            efi_switch.set_sensitive(await EFIBootManager.IsUseable());
            grub_switch.set_sensitive(await Grub.IsUseable());
            sysd_switch.set_sensitive(await SystemdBoot.IsUseable());
        })();
    }
}
