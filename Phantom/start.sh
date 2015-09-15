#!/bin/bash
for i in `seq 1 $1`;
do
    nohup node manage_client.js $i $2 &
done
wait