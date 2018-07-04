(Disclaimer: This is my first project using javascript, so please let me know anything I could improve on)
The aim of the project was to see if I could monitor the processes running in a device such as a raspberry pi and log the data in a database on another computer. This database can then be stored for future use or to create real time graphs (Eg. with Plotly or Highcharts).

The json data expected is in the format of: 
{
    "time": ,
    "cpu usage": ,
"processes" : [
    {
        "name":
        "pid":
        "stack":
        "heap":
        "total":
    },
    { ... }
]
}

To track more fields, just make the appropriate changes in the database entry code. 

