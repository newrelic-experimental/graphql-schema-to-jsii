## boilerplate

- per _kind_ (eg CDK, CF custom resource, standalone, ...)

## constructor

- create client, accept client configuration parameter

## Operations

- For each operation (mutation | query)
    - Method signature is derived from the document
        - name (known when the document creates the 'header')
        - inputs (parsed when the document creates the 'header' as 'document variables')
        - output (the type of the query|mutation field)
    - Load the input params into the doc
    - Execute the doc
    - Return result | error