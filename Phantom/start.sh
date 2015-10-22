#!/bin/bash
echo start $1 $2
for i in `seq 1 $1`;
do
    nohup node manage_client.js $i $2 &
done
wait