#!/bin/bash
for i in `seq 1 $1`;
do
    node manage_client.js $i $2 &
done
wait