#!/bin/sh
id=$(cat ../config.js | grep datacenterId | grep -Po [0-9]*)
sh start.sh $id 100