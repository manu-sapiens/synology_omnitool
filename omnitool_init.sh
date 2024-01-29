#!/bin/bash
echo "[->] START v0001.000"

echo "[->] UPDATE OMNITOOL if needed"
cd ./omnitool

output=$(git pull)
if echo "$output" | grep -q "Already up to date."; then
  echo "The repository is already up to date."
else
  echo "New data was fetched."
  echo "[->] YARN INSTALL"
  yarn

  echo "[->] Updating permissions"
  chmod -R 0777 .
  chown -Rh node:node .
fi

echo "[->] YARN START "
yarn start -u -rb -R blocks --noupdate -ll 2
