#!/bin/bash
rm -rf hibernate-status.zip
glib-compile-schemas schemas/
zip -r hibernate-status.zip * -x buildforupload.sh
