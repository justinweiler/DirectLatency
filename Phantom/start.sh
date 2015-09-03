#!/bin/bash
for i in `seq 1 $1`;
do
    phantomjs client.js $i $2 &
done
wait