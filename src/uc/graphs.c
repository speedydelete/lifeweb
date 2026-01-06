
#include <stdbool.h>
#include <inttypes.h>
#include <string.h>
#include <stdlib.h>
#include <stdio.h>
#include <math.h>


typedef struct edge {
    uint32_t end;
    uint32_t cost;
    uint32_t recipe_number;
} edge;

typedef edge* vertex;

vertex** vertices;
uint32_t vertex_count;
uint32_t* edge_counts;


typedef struct distance {
    int value;
    vertex* path_prev;
    uint32_t recipe_number;
} distance;

distance* distances;

typedef struct queue_elt {
    vertex* vertex;
    int vertex_number;
    int distance;
    struct queue_elt* next;
} queue_elt;

queue_elt* queue;


void load_graph(void) {
    FILE* file = fopen("graph_data", "rb");
    if (file == NULL) {
        printf("Error opening input file!\n");
        exit(1);
    }
    fread(&vertex_count, 4, 1, file);
    vertices = malloc(vertex_count * sizeof(void*));
    edge_counts = malloc(vertex_count * 4);
    fread(edge_counts, 4, vertex_count, file);
    for (int i = 0; i < vertex_count; i++) {
        vertex vertex = malloc(edge_counts[i] * sizeof(edge));
        fread(&vertex, sizeof(edge), edge_counts[i], file);
        vertices[i] = &vertex;
    }
    fclose(file);
}

bool* done;

void dijkstra(int start_vertex_number) {
    int loc = 0;
    for (int i = 0; i < vertex_count; i++) {
        distance* dist = &distances[loc++];
        dist->value = i == start_vertex_number ? 0 : INFINITY;
        dist->path_prev = NULL;
        done[i] = false;
    }
    while (queue != NULL) {
        queue_elt* next = queue->next;
        free(queue);
        queue = next;
    }
    queue = malloc(sizeof(queue_elt));
    queue->vertex = vertices[start_vertex_number];
    queue->vertex_number = start_vertex_number;
    queue->distance = 0;
    queue->next = NULL;
    while (queue != NULL) {
        queue_elt* elt = queue;
        if (done[elt->vertex_number]) {
            queue = elt->next;
            free(elt);
            continue;
        } else {
            done[elt->vertex_number] = true;
        }
        vertex current = *elt->vertex;
        int edges = edge_counts[elt->vertex_number];
        for (int i = 0; i < edges; i++) {
            edge edge = current[i];
            int new_dist = elt->distance + edge.cost;
            distance dist = distances[edge.end];
            if (new_dist < dist.value) {
                dist.value = new_dist;
                dist.path_prev = &current;
                dist.recipe_number = edge.recipe_number;
                // insertion code
            }
        }
        queue = elt->next;
        free(elt);
    }
    free(done);
}

void save_results(distance* data) {
    FILE* file = fopen("out", "wb");
    if (file == NULL) {
        printf("Error opening output file!\n");
        exit(1);
    }
    fwrite(data, sizeof(distance), vertex_count * vertex_count, file);
    fclose(file);
}

int main(void) {
    load_graph();
    size_t dist_size = vertex_count * sizeof(distance);
    distances = malloc(dist_size);
    distance* out = malloc(vertex_count * dist_size);
    done = malloc(vertex_count * sizeof(bool));
    for (int i = 0; i < vertex_count; i++) {
        dijkstra(i);
        memcpy(out + i * vertex_count, distances, dist_size);
    }
    save_results(out);
    free(out);
    return 0;
}
