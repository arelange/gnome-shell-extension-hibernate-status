# Basic Makefile

UUID = hibernate-status@dromi
BASE_MODULES = extension.js metadata.json LICENSE README.md
EXTRA_MODULES = prefs.js
CUSTOM_REBOOT_MODULES = customreboot
TOLOCALIZE =  confirmDialog.js prefs.js
PO_FILES := $(wildcard ./locale/*/*/*.po)
MO_FILES := $(PO_FILES:.po=.mo)

ifeq ($(strip $(DESTDIR)),)
	INSTALLTYPE = local
	INSTALLBASE = $(HOME)/.local/share/gnome-shell/extensions
else
	INSTALLTYPE = system
	SHARE_PREFIX = $(DESTDIR)/usr/share
	INSTALLBASE = $(SHARE_PREFIX)/gnome-shell/extensions
endif
INSTALLNAME = hibernate-status@dromi

all: extension

clean:
	rm -f ./schemas/gschemas.compiled
	rm -f ./**/*~
	rm -f ./locale/*/*/*.mo
	rm -f ./locale/hibernate-status-button.pot

extension: ./schemas/gschemas.compiled $(MO_FILES)

./schemas/gschemas.compiled: ./schemas/org.gnome.shell.extensions.hibernate-status-button.gschema.xml
	glib-compile-schemas ./schemas/

potfile: ./locale/hibernate-status-button.pot

mergepo: potfile
	for l in $(PO_FILES); do \
		msgmerge -U $$l ./locale/hibernate-status-button.pot; \
	done;

./locale/hibernate-status-button.pot: $(TOLOCALIZE)
	mkdir -p locale
	xgettext -k --keyword=__ --keyword=N__ --add-comments='Translators:' -o locale/hibernate-status-button.pot --package-name "Hibernate Status Button" $(TOLOCALIZE)

%.mo: %.po
	msgfmt -c $< -o $@

install: install-local

install-local: _build
	rm -rf $(INSTALLBASE)/$(INSTALLNAME)
	mkdir -p $(INSTALLBASE)/$(INSTALLNAME)
	cp -r ./_build/* $(INSTALLBASE)/$(INSTALLNAME)/
ifeq ($(INSTALLTYPE),system)
	# system-wide settings and locale files
	rm -r $(INSTALLBASE)/$(INSTALLNAME)/schemas
	rm -r $(INSTALLBASE)/$(INSTALLNAME)/locale
	mkdir -p $(SHARE_PREFIX)/glib-2.0/schemas $(SHARE_PREFIX)/locale
	cp -r ./schemas/*gschema.* $(SHARE_PREFIX)/glib-2.0/schemas
	cp -r ./_build/locale/* $(SHARE_PREFIX)/locale
endif
	-rm -fR _build
	echo done

zip-file: _build
	cd _build ; zip -qr "$(UUID).zip" . -x '*.po'
	mv _build/$(UUID).zip ./
	-rm -fR _build

_build: all
	-rm -fR ./_build
	mkdir -p _build
	cp -r $(BASE_MODULES) $(EXTRA_MODULES) $(CUSTOM_REBOOT_MODULES) _build
	mkdir -p _build/schemas
	cp schemas/*.xml _build/schemas/
	cp schemas/gschemas.compiled _build/schemas/
	cp -r locale/ _build/locale
