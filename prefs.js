const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Me = imports.misc.extensionUtils.getCurrentExtension();
// Use __() and N__() for the extension gettext domain, and reuse
// the shell domain with the default _() and N_()
const Gettext = imports.gettext.domain("hibernate-status-button");
const __ = Gettext.gettext;
const N__ = function (e) {
  return e;
};
const ExtensionUtils = imports.misc.extensionUtils;

let _instance = null;
function getInstance() {
  if (!_instance) {
    _instance = new Prefs();
  }

  return _instance;
}

var Prefs = class Prefs {
  /**
   * Creates a new Settings-object to access the settings of this extension.
   * @private
   */
  constructor() {
    this._schemaName = "org.gnome.shell.extensions.hibernate-status-button";
    this.KEY_HIBERNATE_WORKS_CHECK = "hibernate-works-check";
    this.KEY_HYBRID_SLEEP_ENABLED = "hybridsleep-enabled";
    this.KEY_HIBERNATE_ENABLED = "hibernate-enabled";
    this.KEY_HIBERNATE_CONFIRMATION_ENABLED = "hibernate-confirmation-enabled";

    let schemaDir = Me.dir.get_child("schemas").get_path();
    let schemaSource = Gio.SettingsSchemaSource.new_from_directory(
      schemaDir,
      Gio.SettingsSchemaSource.get_default(),
      false
    );
    let schema = schemaSource.lookup(this._schemaName, false);

    // Define the settings store
    this._setting = new Gio.Settings({
      settings_schema: schema,
    });
  }

  buildPrefsPanel() {
    // Define the settings window
    this.frame = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      "margin-top": 10,
      "margin-end": 10,
      "margin-bottom": 10,
      "margin-start": 10,
    });

    // Add the suspend enable toggle option
    this.frame.append(
      this.addBooleanOptionButton(
        this.KEY_HYBRID_SLEEP_ENABLED,
        __("Enable the hybrid suspend option")
      )
    );

    // Add the hibernate enable toggle option
    this.frame.append(
      this.addBooleanOptionButton(
        this.KEY_HIBERNATE_ENABLED,
        __("Enable the hibernate option")
      )
    );

    // Add the hibernate confirmation enable toggle option
    this.frame.append(
      this.addBooleanOptionButton(
        this.KEY_HIBERNATE_CONFIRMATION_ENABLED,
        __("Enable the hibernate confirmation dialog")
      )
    );

    return this.frame;
  }

  /**
   * Creates and returns a boolean option for the Settings panel
   * @param key The setting key name as defined i the schema.xml
   * @param label The name shown to the end-user. Must be wrapped in __() for localization.
   * @returns Gtk.Box with the hybrid suspend enable toggle UI.
   */
  addBooleanOptionButton(key, label) {
    const hbox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      margin_top: 5,
    });

    const switchButtonLabel = new Gtk.Label({
      label,
      xalign: 0,
      hexpand: true,
    });

    const switchButton = new Gtk.Switch({
      active: this._setting.get_boolean(key),
    });

    switchButton.connect("notify::active", (button) => {
      this._setting.set_boolean(key, button.active);
    });

    hbox.append(switchButtonLabel);
    hbox.append(switchButton);

    return hbox;
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
    if (
      callback === undefined ||
      callback === null ||
      typeof callback !== "function"
    ) {
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
   * Get if the hybrid sleep option is enabled.
   *
   * @returns bool true if we need to display the option.
   */
  getHybridSleepOptionEnabled() {
    return this._setting.get_boolean(this.KEY_HYBRID_SLEEP_ENABLED);
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
};

// These "preferences" aren't user accessible so define
// init() and buildPrefsWidget() to empty functions
function init() {
  ExtensionUtils.initTranslations("hibernate-status-button");
}
function buildPrefsWidget() {
  const prefs = getInstance();
  return prefs.buildPrefsPanel();
}
