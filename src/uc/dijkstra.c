
#include <inttypes.h>
#include <string.h>
#include <stdlib.h>
#include <stdio.h>
#include <math.h>


#define MAX_DIST 655336


typedef struct edge {
    uint32_t end;
    uint32_t cost;
    uint32_t recipe_number;
} edge;

typedef edge* vertex;

vertex** vertices;
uint32_t vertex_count;
uint32_t* edge_counts;

int load_graph(void) {
    FILE* file = fopen("graph", "rb");
    if (file == NULL) {
        printf("Error opening input file!\n");
        exit(1);
    }
    fread(&vertex_count, 4, 1, file);
    if (ferror(file) || feof(file)) {
        printf("Error while reading vertex count from file!\n");
        fclose(file);
        exit(1);
        return 1;
    }
    vertices = malloc(vertex_count * sizeof(void*));
    edge_counts = malloc(vertex_count * 4);
    int edge_count = 0;
    fread(edge_counts, 4, vertex_count, file);
    if (ferror(file) || feof(file)) {
        printf("Error while reading vertex count from file!\n");
        fclose(file);
        exit(1);
        return 1;
    }
    for (int i = 0; i < vertex_count; i++) {
        edge_count += edge_counts[i];
        vertex* vertex = malloc(edge_counts[i] * 3 * sizeof(edge)); // NOLINT(clang-analyzer-unix.MallocSizeof)
        fread(vertex, sizeof(edge), edge_counts[i], file);
        if (ferror(file) || feof(file)) {
            printf("Error while reading vertex count from file!\n");
            fclose(file);
            exit(1);
            return 1;
        }
        vertices[i] = vertex;
    }
    fclose(file);
    return edge_count;
}

void clear_graph(void) {
    for (int i = 0; i < vertex_count; i++) {
        free(*vertices[i]);
    }
    free(vertices);
}


typedef struct distance_info {
    int value;
    uint32_t path_prev;
    uint32_t recipe_number;
} distance_info;

distance_info** distances;

typedef struct bucket_elt {
    uint32_t vertex_number;
    uint32_t dist;
    struct bucket_elt *next;
} bucket_elt;

bucket_elt* queue[MAX_DIST];
int current_dist = 0;

void clear_queue(void) {
    current_dist = 0;
    for (int i = 0; i < MAX_DIST; i++) {
        bucket_elt* elt = queue[i];
        while (elt != NULL) {
            bucket_elt* next = elt->next;
            free(elt);
            elt = next;
        }
    }
}

void add_to_queue(uint32_t vertex_number, int dist) {
    bucket_elt* elt = malloc(sizeof(bucket_elt));
    elt->vertex_number = vertex_number;
    elt->dist = dist;
    elt->next = queue[dist];
    queue[dist] = elt;
}

bucket_elt* get_queue(void) {
    while (current_dist < MAX_DIST) {
        if (queue[current_dist]) {
            bucket_elt* elt = queue[current_dist];
            queue[current_dist] = elt->next;
            return elt;
        }
        current_dist++;
    }
    return NULL;
}


bool* done;

void dijkstra(int start_vertex_number) {
    int loc = 0;
    for (int i = 0; i < vertex_count; i++) {
        distance_info* dist = distances[loc++];
        dist->value = i == start_vertex_number ? 0 : INFINITY;
        done[i] = false;
    }
    bucket_elt* elt = malloc(sizeof(bucket_elt));
    elt->vertex_number = start_vertex_number;
    elt->dist = 0;
    while (elt != NULL) {
        if (done[elt->vertex_number] || elt->dist != (distances[elt->vertex_number])->value) {
            free(elt);
            elt = get_queue();
            continue;
        }
        done[elt->vertex_number] = true;
        int edges = edge_counts[elt->vertex_number];
        for (int i = 0; i < edges; i++) {
            edge edge = (*vertices[elt->vertex_number])[i];
            int new_dist = elt->dist + edge.cost;
            distance_info* dist = distances[edge.end]; // NOLINT(clang-analyzer-security.ArrayBound)
            if (new_dist < dist->value) {
                dist->value = new_dist;
                dist->path_prev = elt->vertex_number;
                dist->recipe_number = edge.recipe_number;
                add_to_queue(edge.end, new_dist);
            }
        }
        free(elt);
        elt = get_queue();
    }
}

void save_results(distance_info* data) {
    FILE* file = fopen("out", "wb");
    if (file == NULL) {
        printf("Error opening output file!\n");
        exit(1);
    }
    fwrite(data, sizeof(distance_info), vertex_count * vertex_count, file);
    fclose(file);
}

int main(int argc, char** argv) {
    int edge_count = load_graph();
    memset(queue, 0, sizeof(queue));
    size_t dist_size = vertex_count * sizeof(distance_info*);
    distances = malloc(dist_size);
    for (int i = 0; i < vertex_count; i++) {
        distances[i] = malloc(sizeof(distance_info));
    }
    done = malloc(vertex_count * sizeof(bool));
    printf("Loaded graph consisting of %d vertices and %d edges\n", vertex_count, edge_count);
    if (strcmp(argv[1], "tiles") == 0) {
        printf("Computing all tile conversion recipes\n");
        distance_info* out = malloc(vertex_count * vertex_count * sizeof(distance_info));
        for (int i = 0; i < vertex_count; i++) {
            dijkstra(i);
            for (int j = 0; j < vertex_count; j++) {
                out[i * vertex_count + j] = *distances[j]; // NOLINT(clang-analyzer-security.ArrayBound)
            }
        }
        save_results(out);
        free(out);
    }
    free(done);
    for (int i = 0; i < vertex_count; i++) {
        free(distances[i]);
    }
    free(distances);
    clear_graph();
    return 0;
}
