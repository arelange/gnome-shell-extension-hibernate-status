const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Me = imports.misc.extensionUtils.getCurrentExtension();
// Use __() and N__() for the extension gettext domain, and reuse
// the shell domain with the default _() and N_()
const Gettext = imports.gettext.domain('hibernate-status-button');
const __ = Gettext.gettext;
const N__ = function(e) { return e };
const ExtensionUtils = imports.misc.extensionUtils;

var Prefs = class Prefs {
    /**
     * Creates a new Settings-object to access the settings of this extension.
     * @private
     */
    constructor() {
        this.KEY_HIBERNATE_WORKS_CHECK = "hibernate-works-check";
        this._schemaName = "org.gnome.shell.extensions.hibernate-status-button";

        // first try developer local schema
        try {
            let schemaDir = Me.dir.get_child('schemas').get_path();

            let schemaSource = Gio.SettingsSchemaSource.new_from_directory(
                schemaDir, Gio.SettingsSchemaSource.get_default(), false
            );
            let schema = schemaSource.lookup(this._schemaName, false);

            this._setting = new Gio.Settings({
                settings_schema: schema
            });
            return;
        } catch (e) {
            // now try system-wide one below
        }

        this._setting = new Gio.Settings({
            schema_id: this._schemaName
        });
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
        if (key === undefined || key === null || typeof key !== "string") {
            throw TypeError("The 'key' should be a string. Got: '" + key + "'");
        }
        if (callback === undefined || callback === null || typeof callback !== "function") {
            throw TypeError("'callback' needs to be a function. Got: " + callback);
        }
        // Bind:
        this._setting.connect("changed::" + key, function (source, key) {
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
}

// These "preferences" aren't user accessible so define
// init() and buildPrefsWidget() to empty functions
function init() {
    ExtensionUtils.initTranslations('hibernate-status-button');
}
function buildPrefsWidget() {
    let frame = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL,
                             'margin-top': 10,
                             'margin-end': 10,
                             'margin-bottom': 10,
                             'margin-start': 10});
    let setting_label = new Gtk.Label({label: __("This extension has no settings available"),
                                       xalign: 0 });
    frame.append(setting_label);
    return frame;
}
